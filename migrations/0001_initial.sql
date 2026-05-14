CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE rooms (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  deck         TEXT NOT NULL CHECK (deck IN ('fib', 'tshirt')),
  host_user_id TEXT NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL,
  archived_at  INTEGER
);
CREATE INDEX idx_rooms_host ON rooms(host_user_id);

CREATE TABLE room_members (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role    TEXT NOT NULL CHECK (role IN ('host', 'member')),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX idx_room_members_user ON room_members(user_id);

CREATE TABLE stories (
  id              TEXT PRIMARY KEY,
  room_id         TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  position        INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'voting', 'estimated', 'skipped')),
  final_estimate  TEXT,
  final_round_id  TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_stories_room ON stories(room_id, position);

CREATE TABLE vote_rounds (
  id                TEXT PRIMARY KEY,
  story_id          TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  round_number      INTEGER NOT NULL,
  started_at        INTEGER NOT NULL,
  revealed_at       INTEGER,
  accepted_estimate TEXT,
  UNIQUE (story_id, round_number)
);
CREATE INDEX idx_rounds_story ON vote_rounds(story_id, round_number);

CREATE TABLE votes (
  round_id TEXT NOT NULL REFERENCES vote_rounds(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id),
  value    TEXT NOT NULL,
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (round_id, user_id)
);
