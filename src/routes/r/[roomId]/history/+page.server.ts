import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getRoom, isMember } from '$lib/server/db';
import type { Story, VoteRound, Vote } from '$lib/types';

// Loads the full audit trail for a room: every story with every round and
// every vote cast in that round. Shaped into a nested structure the UI can
// render directly with `HistoryStrip`.
//
// Two follow-up queries (rounds, then votes) are issued only when there is
// something to look up — D1 rejects `IN ()` with an empty parameter list.
export const load: PageServerLoad = async ({ locals, platform, params }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw redirect(302, '/');
  if (!platform?.env?.DB) throw error(500, 'db unavailable');
  const db = platform.env.DB;

  const room = await getRoom(db, params.roomId);
  if (!room) throw error(404);
  if (!(await isMember(db, room.id, auth.userId))) throw error(403);

  const stories = (
    await db
      .prepare(
        'SELECT * FROM stories WHERE room_id = ? ORDER BY position'
      )
      .bind(room.id)
      .all<Story>()
  ).results;

  const storyIds = stories.map((s) => s.id);
  const rounds = storyIds.length
    ? (
        await db
          .prepare(
            `SELECT * FROM vote_rounds WHERE story_id IN (${storyIds.map(() => '?').join(',')})`
          )
          .bind(...storyIds)
          .all<VoteRound>()
      ).results
    : [];

  const roundIds = rounds.map((r) => r.id);
  type VoteRow = Vote & { display_name: string };
  const votes: VoteRow[] = roundIds.length
    ? (
        await db
          .prepare(
            `SELECT v.*, u.display_name FROM votes v
             JOIN users u ON u.id = v.user_id
             WHERE round_id IN (${roundIds.map(() => '?').join(',')})`
          )
          .bind(...roundIds)
          .all<VoteRow>()
      ).results
    : [];

  const byRound = votes.reduce<Record<string, VoteRow[]>>((acc, v) => {
    (acc[v.round_id] ??= []).push(v);
    return acc;
  }, {});
  type RoundWithVotes = VoteRound & { votes: VoteRow[] };
  const byStory = rounds.reduce<Record<string, RoundWithVotes[]>>(
    (acc, r) => {
      (acc[r.story_id] ??= []).push({ ...r, votes: byRound[r.id] ?? [] });
      return acc;
    },
    {}
  );

  return {
    room,
    stories: stories.map((s) => ({
      ...s,
      rounds: (byStory[s.id] ?? []).sort(
        (a, b) => a.round_number - b.round_number
      )
    })),
    you: {
      userId: auth.userId,
      isHost: room.host_user_id === auth.userId
    }
  };
};
