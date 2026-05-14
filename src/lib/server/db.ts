import type { D1Database } from '@cloudflare/workers-types';
import type { Room, Story, VoteRound, User, MemberRole } from '$lib/types';

export const upsertUser = async (db: D1Database, u: User) => {
  await db
    .prepare(
      'INSERT INTO users (id, display_name, avatar_url, created_at) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, avatar_url = excluded.avatar_url'
    )
    .bind(u.id, u.display_name, u.avatar_url, u.created_at)
    .run();
};

export const createRoom = async (db: D1Database, r: Room) => {
  await db.batch([
    db
      .prepare(
        'INSERT INTO rooms (id, name, deck, host_user_id, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(r.id, r.name, r.deck, r.host_user_id, r.created_at),
    db
      .prepare(
        'INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
      )
      .bind(r.id, r.host_user_id, 'host', r.created_at)
  ]);
};

export const getRoom = (db: D1Database, id: string) =>
  db.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<Room>();

export const isMember = async (db: D1Database, roomId: string, userId: string) => {
  const r = await db
    .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
    .bind(roomId, userId)
    .first();
  return r !== null;
};

export const ensureMember = async (
  db: D1Database,
  roomId: string,
  userId: string,
  role: MemberRole = 'member'
) => {
  await db
    .prepare(
      'INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(room_id, user_id) DO NOTHING'
    )
    .bind(roomId, userId, role, Date.now())
    .run();
};

export const listUserRooms = (db: D1Database, userId: string) =>
  db
    .prepare(
      `SELECT r.*, rm.role
     FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id
     WHERE rm.user_id = ? AND r.archived_at IS NULL
     ORDER BY r.created_at DESC`
    )
    .bind(userId)
    .all<Room & { role: MemberRole }>();

export const listStories = (db: D1Database, roomId: string) =>
  db
    .prepare('SELECT * FROM stories WHERE room_id = ? ORDER BY position')
    .bind(roomId)
    .all<Story>();

export const insertStory = async (db: D1Database, s: Story) => {
  await db
    .prepare(
      'INSERT INTO stories (id, room_id, title, description, position, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(s.id, s.room_id, s.title, s.description, s.position, s.status, s.created_at)
    .run();
};

export const insertRound = async (db: D1Database, r: VoteRound) => {
  await db
    .prepare(
      'INSERT INTO vote_rounds (id, story_id, round_number, started_at) VALUES (?, ?, ?, ?)'
    )
    .bind(r.id, r.story_id, r.round_number, r.started_at)
    .run();
};

export const flushVotes = async (
  db: D1Database,
  roundId: string,
  votes: { userId: string; value: string }[]
) => {
  const now = Date.now();
  const stmts = [
    db.prepare('UPDATE vote_rounds SET revealed_at = ? WHERE id = ?').bind(now, roundId),
    ...votes.map((v) =>
      db
        .prepare('INSERT INTO votes (round_id, user_id, value, voted_at) VALUES (?, ?, ?, ?)')
        .bind(roundId, v.userId, v.value, now)
    )
  ];
  await db.batch(stmts);
};

export const acceptRound = async (
  db: D1Database,
  roundId: string,
  storyId: string,
  value: string
) =>
  db.batch([
    db.prepare('UPDATE vote_rounds SET accepted_estimate = ? WHERE id = ?').bind(value, roundId),
    db
      .prepare('UPDATE stories SET status = ?, final_estimate = ?, final_round_id = ? WHERE id = ?')
      .bind('estimated', value, roundId, storyId)
  ]);

export const getRoomHistory = (db: D1Database, roomId: string) =>
  db
    .prepare(
      `SELECT s.id story_id, s.title, s.description, s.status, s.final_estimate, s.created_at,
            vr.id round_id, vr.round_number, vr.revealed_at, vr.accepted_estimate
     FROM stories s
     LEFT JOIN vote_rounds vr ON vr.story_id = s.id
     WHERE s.room_id = ?
     ORDER BY s.position, vr.round_number`
    )
    .bind(roomId)
    .all();
