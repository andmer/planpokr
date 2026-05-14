// Room Durable Object — owns the live state of one planning-poker room.
//
// Uses hibernatable WebSockets: `ctx.acceptWebSocket` lets the DO sleep
// between messages while keeping connected sockets. Per-socket auth claims
// are persisted via `serializeAttachment` so they survive hibernation.
//
// Pre-reveal vote state lives only in `this.current` (an in-memory field).
// Per the spec this is acceptable: if the DO is evicted mid-round the votes
// are lost, and the host can simply start the round again.

import { DurableObject } from 'cloudflare:workers';
import { verifyRoomToken, type RoomClaims } from '$lib/server/auth';
import type {
  ClientMsg,
  ServerMsg,
  Presence,
  PriorRound,
  LastFinalized
} from './messages';
import { computeStats } from '$lib/stats';
import type { Story, VoteRound, Vote } from '$lib/types';

type Env = { DB: D1Database; ROOM_TOKEN_SECRET: string };

type SessionAttachment = { userId: string; role: 'host' | 'member' };

type CurrentMem = {
  storyId: string;
  roundId: string;
  roundNumber: number;
  revealed: boolean;
  /** userId → value, pre-reveal only. Cleared after `reveal`. */
  pre: Map<string, string>;
} | null;

/** Subset of CurrentMem persisted to storage. The pre-reveal vote map is
 *  intentionally left out — pre-reveal votes are transient by design (the
 *  spec accepts losing them on hibernation; the host just re-runs the round).
 *  Post-reveal votes already live in the `votes` table. */
type CurrentPersisted = Omit<NonNullable<CurrentMem>, 'pre'>;

export class RoomDO extends DurableObject<Env> {
  /** In-memory active round state. Hydrated from storage on first access so
   *  it survives hibernation: a host that revealed a round, then everyone
   *  closed the tab and came back, lands on the same reveal pane instead of
   *  a fresh empty room. */
  private current: CurrentMem = null;
  private currentRestored = false;

  // ---- session helpers ----

  private session(ws: WebSocket): SessionAttachment | null {
    const data = ws.deserializeAttachment();
    return (data as SessionAttachment | null) ?? null;
  }

  private async presence(): Promise<Presence[]> {
    const sockets = this.ctx.getWebSockets();
    const list = await Promise.all(
      sockets.map(async (ws) => {
        const s = this.session(ws);
        if (!s) return null;
        const u = await this.env.DB.prepare(
          'SELECT display_name FROM users WHERE id = ?'
        )
          .bind(s.userId)
          .first<{ display_name: string }>();
        const name = u?.display_name ?? 'anon';
        return {
          userId: s.userId,
          initial: (name[0] ?? '?').toUpperCase(),
          name,
          status: 'present' as const,
          voted: this.current?.pre.has(s.userId) ?? false
        };
      })
    );
    return list.filter(Boolean) as Presence[];
  }

  private broadcast(msg: ServerMsg, except?: WebSocket) {
    const payload = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== except) {
        try {
          ws.send(payload);
        } catch {
          /* socket already closed */
        }
      }
    }
  }

  private errTo(ws: WebSocket, code: string, message: string) {
    try {
      ws.send(
        JSON.stringify({ type: 'error', code, message } satisfies ServerMsg)
      );
    } catch {
      /* ignore */
    }
  }

  private async roomId(): Promise<string> {
    const v = await this.ctx.storage.get<string>('roomId');
    if (!v) throw new Error('roomId not initialized');
    return v;
  }

  /** Persisted across hibernation so that clients (re)joining always see the
   *  most recent finalised result in the HeroPane, not a blank empty state. */
  private async getLastFinalized(): Promise<LastFinalized | null> {
    return (await this.ctx.storage.get<LastFinalized>('lastFinalized')) ?? null;
  }
  private async setLastFinalized(v: LastFinalized | null): Promise<void> {
    if (v) await this.ctx.storage.put('lastFinalized', v);
    else await this.ctx.storage.delete('lastFinalized');
  }

  /** Hydrate `this.current` from persisted storage on first call after
   *  hibernation. Pre-reveal votes are intentionally lost (spec); reveal
   *  state is restored fully — the post-reveal `votes` map is rebuilt from
   *  the `votes` table on demand inside sendState. */
  private async ensureCurrent(): Promise<void> {
    if (this.currentRestored) return;
    this.currentRestored = true;
    const persisted = await this.ctx.storage.get<CurrentPersisted>('current');
    if (persisted) {
      this.current = { ...persisted, pre: new Map() };
    }
  }
  private async persistCurrent(): Promise<void> {
    if (!this.current) {
      await this.ctx.storage.delete('current');
      return;
    }
    const { storyId, roundId, roundNumber, revealed } = this.current;
    await this.ctx.storage.put<CurrentPersisted>('current', {
      storyId,
      roundId,
      roundNumber,
      revealed
    });
  }

  // ---- DO fetch handler ----

  async fetch(req: Request): Promise<Response> {
    await this.ensureCurrent();
    const url = new URL(req.url);

    if (url.pathname === '/ws') {
      const token = url.searchParams.get('t');
      if (!token) return new Response('missing token', { status: 401 });
      let claims: RoomClaims;
      try {
        claims = await verifyRoomToken(this.env.ROOM_TOKEN_SECRET, token);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'invalid';
        return new Response(`auth: ${msg}`, { status: 401 });
      }

      const pair = new WebSocketPair();
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({
        userId: claims.userId,
        role: claims.role
      } satisfies SessionAttachment);

      // Persist roomId on first connect so DB writes that need it later work.
      await this.ctx.storage.put('roomId', claims.roomId);

      await this.sendState(server, claims);
      this.broadcast(
        { type: 'presence', userId: claims.userId, status: 'joined' },
        server
      );
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === '/broadcast' && req.method === 'POST') {
      const msg = (await req.json()) as ServerMsg;
      this.broadcast(msg);
      return new Response('ok');
    }

    return new Response('not found', { status: 404 });
  }

  // ---- WebSocket message dispatch ----

  async webSocketMessage(ws: WebSocket, data: ArrayBuffer | string) {
    await this.ensureCurrent();
    const s = this.session(ws);
    if (!s) {
      ws.close(4401, 'no session');
      return;
    }
    let msg: ClientMsg;
    try {
      msg = JSON.parse(
        typeof data === 'string' ? data : new TextDecoder().decode(data)
      );
    } catch {
      return this.errTo(ws, 'bad_json', 'malformed JSON');
    }

    switch (msg.type) {
      case 'ping':
        return;

      case 'hello':
        // Initial state was already sent on connect; treat as no-op.
        return;

      case 'start_round': {
        if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
        const next = await this.env.DB.prepare(
          'SELECT COALESCE(MAX(round_number), 0) + 1 AS n FROM vote_rounds WHERE story_id = ?'
        )
          .bind(msg.storyId)
          .first<{ n: number }>();
        const roundNumber = next?.n ?? 1;
        const roundId = crypto.randomUUID();
        const startedAt = Date.now();
        await this.env.DB.batch([
          this.env.DB.prepare(
            'INSERT INTO vote_rounds (id, story_id, round_number, started_at) VALUES (?, ?, ?, ?)'
          ).bind(roundId, msg.storyId, roundNumber, startedAt),
          this.env.DB.prepare(
            "UPDATE stories SET status = 'voting' WHERE id = ?"
          ).bind(msg.storyId)
        ]);
        this.current = {
          storyId: msg.storyId,
          roundId,
          roundNumber,
          revealed: false,
          pre: new Map()
        };
        // Starting a new round means we've moved past the prior result.
        await this.setLastFinalized(null);
        await this.persistCurrent();
        const priorRounds = await this.priorRoundsForStory(msg.storyId);
        this.broadcast({
          type: 'round_started',
          storyId: msg.storyId,
          roundId,
          roundNumber,
          priorRounds
        });
        return;
      }

      case 'vote': {
        if (!this.current || this.current.revealed) {
          return this.errTo(ws, 'stale', 'no active round');
        }
        this.current.pre.set(s.userId, msg.value);
        this.broadcast({
          type: 'presence',
          userId: s.userId,
          status: 'voted'
        });
        return;
      }

      case 'clear_vote': {
        if (!this.current || this.current.revealed) return;
        this.current.pre.delete(s.userId);
        this.broadcast({
          type: 'presence',
          userId: s.userId,
          status: 'cleared'
        });
        return;
      }

      case 'reveal': {
        if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
        if (!this.current || this.current.revealed) {
          return this.errTo(ws, 'stale', 'nothing to reveal');
        }
        const votes = Object.fromEntries(this.current.pre);
        this.current.revealed = true;
        await this.flushVotes(this.current.roundId, votes);
        await this.persistCurrent();
        this.broadcast({
          type: 'revealed',
          roundId: this.current.roundId,
          votes,
          stats: computeStats(votes)
        });
        return;
      }

      case 'accept': {
        if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
        if (!this.current?.revealed) {
          return this.errTo(ws, 'stale', 'reveal first');
        }
        const { roundId, storyId } = this.current;
        await this.env.DB.batch([
          this.env.DB.prepare(
            'UPDATE vote_rounds SET accepted_estimate = ? WHERE id = ?'
          ).bind(msg.value, roundId),
          this.env.DB.prepare(
            "UPDATE stories SET status = 'estimated', final_estimate = ?, final_round_id = ? WHERE id = ?"
          ).bind(msg.value, roundId, storyId)
        ]);
        await this.setLastFinalized({
          storyId,
          estimate: msg.value,
          kind: 'accepted'
        });
        this.broadcast({
          type: 'accepted',
          storyId,
          estimate: msg.value
        });
        this.current = null;
        await this.persistCurrent();
        return;
      }

      case 'revote': {
        if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
        if (!this.current?.revealed) {
          return this.errTo(ws, 'stale', 'reveal first');
        }
        const storyId = this.current.storyId;
        const next = await this.env.DB.prepare(
          'SELECT COALESCE(MAX(round_number), 0) + 1 AS n FROM vote_rounds WHERE story_id = ?'
        )
          .bind(storyId)
          .first<{ n: number }>();
        const roundNumber = next?.n ?? 1;
        const roundId = crypto.randomUUID();
        await this.env.DB.prepare(
          'INSERT INTO vote_rounds (id, story_id, round_number, started_at) VALUES (?, ?, ?, ?)'
        )
          .bind(roundId, storyId, roundNumber, Date.now())
          .run();
        this.current = {
          storyId,
          roundId,
          roundNumber,
          revealed: false,
          pre: new Map()
        };
        await this.setLastFinalized(null);
        await this.persistCurrent();
        const priorRounds = await this.priorRoundsForStory(storyId);
        this.broadcast({
          type: 'round_started',
          storyId,
          roundId,
          roundNumber,
          priorRounds
        });
        return;
      }

      case 'skip': {
        if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
        if (!this.current) return;
        const storyId = this.current.storyId;
        await this.env.DB.prepare(
          "UPDATE stories SET status = 'skipped' WHERE id = ?"
        )
          .bind(storyId)
          .run();
        await this.setLastFinalized({ storyId, estimate: '—', kind: 'skipped' });
        this.broadcast({ type: 'skipped', storyId });
        this.current = null;
        await this.persistCurrent();
        return;
      }

      case 'kick': {
        if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
        this.broadcast({ type: 'kicked', userId: msg.userId });
        for (const target of this.ctx.getWebSockets()) {
          const ts = this.session(target);
          if (ts?.userId === msg.userId) {
            try {
              target.close(4001, 'kicked');
            } catch {
              /* ignore */
            }
          }
        }
        if (this.current) this.current.pre.delete(msg.userId);
        return;
      }

      case 'transfer_host': {
        if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
        const roomId = await this.roomId();
        await this.env.DB.prepare(
          'UPDATE rooms SET host_user_id = ? WHERE id = ?'
        )
          .bind(msg.userId, roomId)
          .run();
        for (const w of this.ctx.getWebSockets()) {
          const att = this.session(w);
          if (att) {
            const role: 'host' | 'member' =
              att.userId === msg.userId ? 'host' : 'member';
            w.serializeAttachment({ ...att, role });
          }
        }
        this.broadcast({ type: 'host_changed', hostUserId: msg.userId });
        return;
      }

      case 'claim_host': {
        // v1 heuristic: allow only if no host socket is currently attached.
        // A production version would track last-seen timestamp for the host.
        const hostPresent = this.ctx
          .getWebSockets()
          .some((w) => this.session(w)?.role === 'host');
        if (hostPresent) {
          return this.errTo(ws, 'host_present', 'cannot claim');
        }
        const roomId = await this.roomId();
        await this.env.DB.prepare(
          'UPDATE rooms SET host_user_id = ? WHERE id = ?'
        )
          .bind(s.userId, roomId)
          .run();
        for (const w of this.ctx.getWebSockets()) {
          const att = this.session(w);
          if (att) {
            const role: 'host' | 'member' =
              att.userId === s.userId ? 'host' : 'member';
            w.serializeAttachment({ ...att, role });
          }
        }
        this.broadcast({ type: 'host_changed', hostUserId: s.userId });
        return;
      }

      default: {
        const _exhaustive: never = msg;
        return this.errTo(
          ws,
          'unimpl',
          `unhandled: ${(_exhaustive as ClientMsg).type}`
        );
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    const s = this.session(ws);
    if (!s) return;
    // Don't strand a pre-reveal vote from a user who just disconnected.
    if (this.current && !this.current.revealed) {
      this.current.pre.delete(s.userId);
    }
    this.broadcast({ type: 'presence', userId: s.userId, status: 'left' });
  }

  async webSocketError(ws: WebSocket) {
    // Treat like close — clean up any pending vote.
    return this.webSocketClose(ws);
  }

  // ---- helpers ----

  private async sendState(ws: WebSocket, claims: RoomClaims) {
    const db = this.env.DB;
    const room = await db
      .prepare('SELECT * FROM rooms WHERE id = ?')
      .bind(claims.roomId)
      .first<{
        id: string;
        name: string;
        deck: 'fib' | 'tshirt';
        host_user_id: string;
      }>();
    if (!room) {
      try {
        ws.close(4404, 'room not found');
      } catch {
        /* ignore */
      }
      return;
    }
    const stories = (
      await db
        .prepare(
          'SELECT * FROM stories WHERE room_id = ? ORDER BY position'
        )
        .bind(claims.roomId)
        .all<Story>()
    ).results;

    // For a revealed round (especially after a wake-from-hibernation
    // restore where this.current.pre is empty), rehydrate the votes from
    // the `votes` table so the reveal pane on the client renders the same
    // chips and stats it had before the page reload.
    let restoredVotes: Record<string, string> | undefined;
    let restoredStats: ReturnType<typeof computeStats> | undefined;
    if (this.current?.revealed) {
      const rows = (
        await db
          .prepare('SELECT user_id, value FROM votes WHERE round_id = ?')
          .bind(this.current.roundId)
          .all<{ user_id: string; value: string }>()
      ).results;
      restoredVotes = Object.fromEntries(rows.map((r) => [r.user_id, r.value]));
      restoredStats = computeStats(restoredVotes);
    }

    const current = this.current
      ? {
          storyId: this.current.storyId,
          roundId: this.current.roundId,
          roundNumber: this.current.roundNumber,
          revealed: this.current.revealed,
          votes: restoredVotes,
          stats: restoredStats,
          voted: Array.from(this.current.pre.keys()),
          priorRounds: await this.priorRoundsForStory(this.current.storyId)
        }
      : null;

    // Only surface lastFinalized when there is no active round — otherwise
    // the active round is the relevant context, not the prior result.
    const lastFinalized = current ? null : await this.getLastFinalized();

    const msg: ServerMsg = {
      type: 'state',
      room: {
        id: room.id,
        name: room.name,
        deck: room.deck,
        hostUserId: room.host_user_id
      },
      stories,
      presence: await this.presence(),
      current,
      lastFinalized,
      you: {
        userId: claims.userId,
        isHost: room.host_user_id === claims.userId
      }
    };
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  /** Fetch all revealed rounds for a story (oldest first), each with its
   *  individual votes joined to user display names and pre-computed stats.
   *  Used to feed the in-room "previous rounds" strip so the UI doesn't need
   *  a separate REST endpoint or to know the DB schema. */
  private async priorRoundsForStory(storyId: string): Promise<PriorRound[]> {
    const db = this.env.DB;
    const rounds = (
      await db
        .prepare(
          'SELECT * FROM vote_rounds WHERE story_id = ? AND revealed_at IS NOT NULL ORDER BY round_number'
        )
        .bind(storyId)
        .all<VoteRound>()
    ).results;
    if (!rounds.length) return [];

    const roundIds = rounds.map((r) => r.id);
    type VoteRow = Vote & { display_name: string };
    const voteRows = (
      await db
        .prepare(
          `SELECT v.*, u.display_name FROM votes v
           JOIN users u ON u.id = v.user_id
           WHERE round_id IN (${roundIds.map(() => '?').join(',')})`
        )
        .bind(...roundIds)
        .all<VoteRow>()
    ).results;

    const byRound: Record<string, VoteRow[]> = {};
    for (const v of voteRows) (byRound[v.round_id] ??= []).push(v);

    return rounds.map((r) => {
      const vs = byRound[r.id] ?? [];
      const votesMap = Object.fromEntries(vs.map((v) => [v.user_id, v.value]));
      return {
        roundNumber: r.round_number,
        votes: vs.map((v) => ({
          userId: v.user_id,
          initial: (v.display_name?.[0] ?? '?').toUpperCase(),
          name: v.display_name ?? 'anon',
          value: v.value
        })),
        stats: computeStats(votesMap),
        acceptedEstimate: r.accepted_estimate
      };
    });
  }

  private async flushVotes(
    roundId: string,
    votes: Record<string, string>
  ): Promise<void> {
    const now = Date.now();
    const entries = Object.entries(votes);
    const stmts = [
      this.env.DB.prepare(
        'UPDATE vote_rounds SET revealed_at = ? WHERE id = ?'
      ).bind(now, roundId),
      ...entries.map(([uid, v]) =>
        this.env.DB.prepare(
          'INSERT INTO votes (round_id, user_id, value, voted_at) VALUES (?, ?, ?, ?)'
        ).bind(roundId, uid, v, now)
      )
    ];
    await this.env.DB.batch(stmts);
  }
}
