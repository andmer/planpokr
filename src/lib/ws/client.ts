// Browser-side WebSocket client for a planpokr room.
//
// `createRoomConnection(roomId)` mints a short-lived ws-ticket via REST, opens
// the DO WebSocket, and reduces the incoming `ServerMsg` stream into a single
// `LiveState` Svelte store. Auto-reconnects with a 1.5s back-off on close.
//
// The store is a `writable<LiveState>`. Svelte 5 components subscribe with the
// `$store` auto-subscribe syntax (e.g. `$state.room`). Templates and effects
// pick that up reactively.

import { writable, type Writable } from 'svelte/store';
import type {
  ClientMsg,
  ServerMsg,
  Presence,
  RevealStats,
  PriorRound
} from '$lib/do/messages';
import type { Story, Deck } from '$lib/types';

export type { PriorRound };

export type LiveCurrent = {
  storyId: string;
  roundId: string;
  roundNumber: number;
  revealed: boolean;
  votes?: Record<string, string>;
  voted?: string[];
  stats?: RevealStats;
  priorRounds?: PriorRound[];
};

export type LiveState = {
  status: 'connecting' | 'open' | 'closed';
  room: { id: string; name: string; deck: Deck; hostUserId: string } | null;
  stories: Story[];
  presence: Presence[];
  current: LiveCurrent | null;
  /** Transient "you just finalised a story" record so the HeroPane can show
   *  the locked-in result in the center until the host moves on. Cleared
   *  when a new round starts or a different story is selected. */
  lastFinalized: { storyId: string; estimate: string; kind: 'accepted' | 'skipped' } | null;
  myVote: string | null;
  you: { userId: string; isHost: boolean } | null;
};

const initial: LiveState = {
  status: 'connecting',
  room: null,
  stories: [],
  presence: [],
  current: null,
  lastFinalized: null,
  myVote: null,
  you: null
};

export type RoomConnection = {
  state: Writable<LiveState>;
  send: (msg: ClientMsg) => void;
  setMyVote: (v: string | null) => void;
  close: () => void;
};

export const createRoomConnection = (roomId: string): RoomConnection => {
  const state: Writable<LiveState> = writable({ ...initial });
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let manualClose = false;

  const apply = (msg: ServerMsg) =>
    state.update((s) => {
      switch (msg.type) {
        case 'state':
          return {
            ...s,
            room: msg.room,
            stories: msg.stories,
            presence: msg.presence,
            current: msg.current
              ? {
                  storyId: msg.current.storyId,
                  roundId: msg.current.roundId,
                  roundNumber: msg.current.roundNumber,
                  revealed: msg.current.revealed,
                  votes: msg.current.votes,
                  voted: msg.current.voted,
                  stats: msg.current.stats,
                  priorRounds: msg.current.priorRounds ?? []
                }
              : null,
            lastFinalized: msg.lastFinalized ?? null,
            you: msg.you,
            status: 'open'
          };
        case 'presence': {
          // upsert presence; the DO sends 'left' for disconnect (mark away).
          const existing = s.presence.find((p) => p.userId === msg.userId);
          if (!existing) return s;
          const next = s.presence.map((p) =>
            p.userId === msg.userId
              ? {
                  ...p,
                  voted: msg.status === 'voted' ? true : msg.status === 'cleared' ? false : p.voted,
                  status: (msg.status === 'left' ? 'away' : 'present') as Presence['status']
                }
              : p
          );
          return { ...s, presence: next };
        }
        case 'round_started':
          return {
            ...s,
            current: {
              storyId: msg.storyId,
              roundId: msg.roundId,
              roundNumber: msg.roundNumber,
              revealed: false,
              voted: [],
              priorRounds: msg.priorRounds ?? []
            },
            // A new round means we've moved past the just-finalised story.
            lastFinalized: null,
            myVote: null,
            presence: s.presence.map((p) => ({ ...p, voted: false })),
            stories: s.stories.map((st) =>
              // Match the server's clear of final_estimate/final_round_id on
              // start_round — re-opening a previously-estimated story.
              st.id === msg.storyId
                ? { ...st, status: 'voting', final_estimate: null, final_round_id: null }
                : st
            )
          };
        case 'revealed':
          return {
            ...s,
            current: s.current
              ? { ...s.current, revealed: true, votes: msg.votes, stats: msg.stats }
              : null
          };
        case 'accepted':
          return {
            ...s,
            current: null,
            lastFinalized: {
              storyId: msg.storyId,
              estimate: msg.estimate,
              kind: 'accepted'
            },
            myVote: null,
            stories: s.stories.map((st) =>
              st.id === msg.storyId
                ? { ...st, status: 'estimated', final_estimate: msg.estimate }
                : st
            )
          };
        case 'skipped':
          return {
            ...s,
            current: null,
            lastFinalized: {
              storyId: msg.storyId,
              estimate: '—',
              kind: 'skipped'
            },
            myVote: null,
            stories: s.stories.map((st) =>
              st.id === msg.storyId ? { ...st, status: 'skipped' } : st
            )
          };
        case 'story_added':
          return { ...s, stories: [...s.stories, msg.story] };
        case 'story_updated':
          return {
            ...s,
            stories: s.stories.map((st) =>
              st.id === msg.storyId
                ? {
                    ...st,
                    ...(msg.title !== undefined && { title: msg.title }),
                    ...(msg.description !== undefined && { description: msg.description })
                  }
                : st
            )
          };
        case 'story_removed':
          return { ...s, stories: s.stories.filter((st) => st.id !== msg.storyId) };
        case 'story_reordered':
          return {
            ...s,
            stories: msg.storyIds
              .map((id) => s.stories.find((st) => st.id === id))
              .filter((st): st is Story => Boolean(st))
          };
        case 'host_changed':
          return {
            ...s,
            room: s.room ? { ...s.room, hostUserId: msg.hostUserId } : null,
            you: s.you ? { ...s.you, isHost: msg.hostUserId === s.you.userId } : null
          };
        case 'kicked':
          // Other clients see the kicked user vanish; the kicked socket itself
          // is closed by the DO with code 4001.
          return { ...s, presence: s.presence.filter((p) => p.userId !== msg.userId) };
        case 'error':
          // Surface via console for now — full toast wiring is post-v1.
          console.warn('[ws] server error', msg.code, msg.message);
          return s;
        default:
          return s;
      }
    });

  const connect = async () => {
    state.update((s) => ({ ...s, status: 'connecting' }));
    try {
      const res = await fetch(`/api/rooms/${roomId}/ws-ticket`, { method: 'POST' });
      if (!res.ok) throw new Error(`ticket ${res.status}`);
      const { token } = (await res.json()) as { token: string };
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/api/rooms/${roomId}/ws?t=${token}`);
      ws.onopen = () => state.update((s) => ({ ...s, status: 'open' }));
      ws.onmessage = (e) => {
        try {
          apply(JSON.parse(e.data) as ServerMsg);
        } catch (err) {
          console.warn('[ws] parse failed', err);
        }
      };
      ws.onclose = () => {
        state.update((s) => ({ ...s, status: 'closed' }));
        if (!manualClose) reconnectTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws?.close();
    } catch (err) {
      console.warn('[ws] connect failed', err);
      state.update((s) => ({ ...s, status: 'closed' }));
      if (!manualClose) reconnectTimer = setTimeout(connect, 1500);
    }
  };

  const send = (msg: ClientMsg) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  const setMyVote = (v: string | null) => state.update((s) => ({ ...s, myVote: v }));

  const close = () => {
    manualClose = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };

  void connect();
  return { state, send, setMyVote, close };
};
