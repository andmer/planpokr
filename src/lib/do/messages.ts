// Discriminated-union message types for the Room Durable Object WebSocket
// protocol. Used by both the DO (server) and the browser client.

import type { Story, Deck } from '$lib/types';
import type { RevealStats } from '$lib/stats';

export type { RevealStats };

// === Client → Server (over WS) ===
export type ClientMsg =
  | { type: 'hello'; token: string }
  | { type: 'vote'; value: string }
  | { type: 'clear_vote' }
  | { type: 'ping' }
  // host-only
  | { type: 'start_round'; storyId: string }
  | { type: 'reveal' }
  | { type: 'accept'; value: string }
  | { type: 'revote' }
  | { type: 'skip' }
  | { type: 'kick'; userId: string }
  | { type: 'transfer_host'; userId: string }
  | { type: 'claim_host' };

// === Server → Client ===
export type Presence = {
  userId: string;
  initial: string;
  name: string;
  status: 'present' | 'away';
  voted: boolean;
};

export type PriorRoundVote = {
  userId: string;
  initial: string;
  name: string;
  value: string;
};

export type PriorRound = {
  roundNumber: number;
  votes: PriorRoundVote[];
  stats: RevealStats;
  acceptedEstimate: string | null;
};

export type CurrentRound =
  | {
      storyId: string;
      roundId: string;
      roundNumber: number;
      revealed: boolean;
      votes?: Record<string, string>;
      /** userIds that have voted in the current (pre-reveal) round. */
      voted: string[];
      stats?: RevealStats;
      /** Revealed earlier rounds for the same story, oldest first. */
      priorRounds?: PriorRound[];
    }
  | null;

export type ServerMsg =
  | {
      type: 'state';
      room: { id: string; name: string; deck: Deck; hostUserId: string };
      stories: Story[];
      presence: Presence[];
      current: CurrentRound;
      you: { userId: string; isHost: boolean };
    }
  | {
      type: 'presence';
      userId: string;
      status: 'joined' | 'left' | 'voted' | 'cleared';
    }
  | {
      type: 'round_started';
      storyId: string;
      roundId: string;
      roundNumber: number;
      /** Snapshot of previously-revealed rounds for this story at the moment
       *  the new round starts. Lets the UI surface "what we voted last time"
       *  the instant a re-vote begins, without an extra round-trip. */
      priorRounds: PriorRound[];
    }
  | {
      type: 'revealed';
      roundId: string;
      votes: Record<string, string>;
      stats: RevealStats;
    }
  | { type: 'accepted'; storyId: string; estimate: string }
  | { type: 'skipped'; storyId: string }
  | { type: 'story_added'; story: Story }
  | {
      type: 'story_updated';
      storyId: string;
      title?: string;
      description?: string;
    }
  | { type: 'story_removed'; storyId: string }
  | { type: 'story_reordered'; storyIds: string[] }
  | { type: 'host_changed'; hostUserId: string }
  | { type: 'kicked'; userId: string }
  | { type: 'error'; code: string; message: string };
