import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { beforeEach, expect, test } from 'vitest';
import * as db from '$lib/server/db';

const sqlite = new Database(':memory:');
sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
sqlite.pragma('foreign_keys = ON');

// Adapter to mimic D1Database surface
const d1: any = {
  prepare: (sql: string) => {
    const stmt = sqlite.prepare(sql);
    let params: any[] = [];
    const obj = {
      bind: (...p: any[]) => {
        params = p;
        return obj;
      },
      first: async <T>() => (stmt.get(...params) as T) ?? null,
      all: async <T>() => ({ results: stmt.all(...params) as T[] }),
      run: async () => stmt.run(...params)
    };
    return obj;
  },
  batch: async (stmts: any[]) => Promise.all(stmts.map((s) => s.run()))
};

beforeEach(() => {
  sqlite.exec(
    'DELETE FROM votes; DELETE FROM vote_rounds; DELETE FROM stories; DELETE FROM room_members; DELETE FROM rooms; DELETE FROM users;'
  );
});

test('round trip: user → room → story → round → vote → accept', async () => {
  await db.upsertUser(d1, {
    id: 'u1',
    display_name: 'Alice',
    avatar_url: null,
    created_at: Date.now()
  });
  await db.createRoom(d1, {
    id: 'r1',
    name: 'Q2',
    deck: 'fib',
    host_user_id: 'u1',
    created_at: Date.now(),
    archived_at: null
  });
  await db.insertStory(d1, {
    id: 's1',
    room_id: 'r1',
    title: 'Auth',
    description: null,
    position: 0,
    status: 'voting',
    final_estimate: null,
    final_round_id: null,
    created_at: Date.now()
  });
  await db.insertRound(d1, {
    id: 'vr1',
    story_id: 's1',
    round_number: 1,
    started_at: Date.now(),
    revealed_at: null,
    accepted_estimate: null
  });
  await db.flushVotes(d1, 'vr1', [{ userId: 'u1', value: '5' }]);
  await db.acceptRound(d1, 'vr1', 's1', '5');

  const room = await db.getRoom(d1, 'r1');
  expect(room?.name).toBe('Q2');
  const stories = await db.listStories(d1, 'r1');
  expect(stories.results[0].status).toBe('estimated');
  expect(stories.results[0].final_estimate).toBe('5');
});
