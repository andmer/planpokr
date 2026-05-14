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
import type { ClientMsg, ServerMsg, Presence } from './messages';
import type { Story } from '$lib/types';

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

export class RoomDO extends DurableObject<Env> {
  /** In-memory active round state. Wiped on hibernation; that is acceptable. */
  private current: CurrentMem = null;

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

  // ---- DO fetch handler ----

  async fetch(req: Request): Promise<Response> {
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

      default:
        return this.errTo(
          ws,
          'unimpl',
          `unhandled: ${(msg as ClientMsg).type}`
        );
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

    const current = this.current
      ? {
          storyId: this.current.storyId,
          roundId: this.current.roundId,
          roundNumber: this.current.roundNumber,
          revealed: this.current.revealed,
          pending: Array.from(this.current.pre.keys())
        }
      : null;

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
}
