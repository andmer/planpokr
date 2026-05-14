export type Deck = 'fib' | 'tshirt';
export type StoryStatus = 'pending' | 'voting' | 'estimated' | 'skipped';
export type MemberRole = 'host' | 'member';

export type User = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: number;
};

export type Room = {
  id: string;
  name: string;
  deck: Deck;
  host_user_id: string;
  created_at: number;
  archived_at: number | null;
};

export type Story = {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  position: number;
  status: StoryStatus;
  final_estimate: string | null;
  final_round_id: string | null;
  created_at: number;
};

export type VoteRound = {
  id: string;
  story_id: string;
  round_number: number;
  started_at: number;
  revealed_at: number | null;
  accepted_estimate: string | null;
};

export type Vote = {
  round_id: string;
  user_id: string;
  value: string;
  voted_at: number;
};
