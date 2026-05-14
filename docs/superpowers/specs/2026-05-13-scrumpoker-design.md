# planpokr — Design Spec

**Date:** 2026-05-13
**Owner:** andmer@gmail.com
**Domain:** planpokr.com
**Status:** Approved (design), pending implementation plan

## 1. Goal

Build a team scrumpoker webapp deployable to Cloudflare via `wrangler`. Used by a single team for estimating stories in real time. Scope is "full team tool": rooms, story list, persistent history across sessions, named users, host controls.

## 2. Non-goals (v1)

- Multi-tenant / public SaaS. Single team, single Cloudflare account.
- Custom card decks. Two built-in decks only.
- Jira/Linear integration. Stories are entered as plain title + description.
- Spectator / observer role. Everyone in a room is a voter.
- Markdown rendering for story descriptions. Plain text.
- Mobile-first UI. Desktop browser is the primary target; layout should degrade gracefully but is not optimized for phones.

## 3. Architecture

One Cloudflare Worker (single `wrangler.toml`) doing three things:

1. **SvelteKit app** using `@sveltejs/adapter-cloudflare`. Serves HTML/JS and REST endpoints for room CRUD, story management, and history reads.
2. **Room Durable Object** — one DO per room, keyed by room ID. Holds live state (connected sockets, current round's pre-reveal votes, presence) and broadcasts via WebSockets.
3. **D1 database** — durable storage for users, rooms, stories, vote rounds, and votes. The DO writes round results to D1 on reveal; SvelteKit server routes do all reads.

```
            ┌───────────────────────────────────────────┐
 Browser ──►│  Worker (SvelteKit + adapter-cloudflare)  │
            │   ├─ pages, REST, auth verification       │
            │   └─ /r/[id]/ws → forwards to DO          │
            │                                            │
            │   Room Durable Object (per roomId)        │
            │     ├─ WebSocket fan-out                  │
            │     └─ ephemeral round state (in-memory)  │
            │                                            │
            │   D1 (users, rooms, stories, rounds, votes)│
            └───────────────────────────────────────────┘
```

### Authentication

Clerk handles login at the SvelteKit layer. Required: every page under `/r/*` and `/rooms/*` is gated behind a verified Clerk session. The Worker exchanges the Clerk session for a short-lived **room token** (signed JWT, 60s TTL, contains `userId`, `roomId`, `role`) when the client requests `/api/rooms/:id/ws-ticket`. The client opens the WebSocket with that token as a query param; the DO verifies the signature locally and rejects unknown rooms/users. The DO never calls Clerk directly.

### Why this shape

- **Durable Object** is the natural fan-out primitive on Cloudflare. Avoids pulling in an external pub/sub.
- **D1 alongside DO storage** lets us cheaply query "show me how the team estimated last sprint" without rehydrating DOs.
- **Single Worker** keeps `wrangler.toml`, CI, and the deploy story trivial.
- **Clerk** removes any need to build/maintain auth.

## 4. Data model (D1)

```sql
users
  id            TEXT PRIMARY KEY,   -- Clerk user id
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    INTEGER NOT NULL

rooms
  id            TEXT PRIMARY KEY,   -- short slug, e.g. "swift-otter-42"
  name          TEXT NOT NULL,
  deck          TEXT NOT NULL,      -- 'fib' | 'tshirt'
  host_user_id  TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  archived_at   INTEGER

room_members                        -- ACL: who has ever joined
  room_id  TEXT NOT NULL REFERENCES rooms(id),
  user_id  TEXT NOT NULL REFERENCES users(id),
  role     TEXT NOT NULL,           -- 'host' | 'member'
  PRIMARY KEY (room_id, user_id)

stories
  id              TEXT PRIMARY KEY,
  room_id         TEXT NOT NULL REFERENCES rooms(id),
  title           TEXT NOT NULL,
  description     TEXT,
  position        INTEGER NOT NULL, -- ordering within the room
  status          TEXT NOT NULL,    -- 'pending' | 'voting' | 'estimated' | 'skipped'
  final_estimate  TEXT,             -- copied from accepted round
  final_round_id  TEXT REFERENCES vote_rounds(id),
  created_at      INTEGER NOT NULL

vote_rounds                         -- one row per vote attempt on a story
  id                 TEXT PRIMARY KEY,
  story_id           TEXT NOT NULL REFERENCES stories(id),
  round_number       INTEGER NOT NULL,   -- 1, 2, 3... within a story
  started_at         INTEGER NOT NULL,
  revealed_at        INTEGER,            -- null until host reveals
  accepted_estimate  TEXT,               -- host-locked value, or null if discarded
  UNIQUE (story_id, round_number)

votes                               -- one row per (round, user)
  round_id  TEXT NOT NULL REFERENCES vote_rounds(id),
  user_id   TEXT NOT NULL REFERENCES users(id),
  value     TEXT NOT NULL,          -- card face: "5", "M", "?", "☕"
  voted_at  INTEGER NOT NULL,
  PRIMARY KEY (round_id, user_id)
```

**Persistence behaviour:**

- Pre-reveal votes live only in DO memory. They are lost if the DO is evicted mid-round — acceptable, since pre-reveal is by definition transient.
- On **reveal**, the DO writes the round's votes to `votes` and stamps `vote_rounds.revealed_at`.
- On **accept**, the DO sets `vote_rounds.accepted_estimate`, `stories.final_estimate`, `stories.final_round_id`, and `stories.status = 'estimated'`.
- On **re-vote**, a new `vote_rounds` row is created with `round_number = previous + 1`. Prior rounds remain intact, giving full audit history.

**Decks (hard-coded in app):**

- `fib`: `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`
- `tshirt`: `XS, S, M, L, XL, ?, ☕`

## 5. Routes

| Path                    | Purpose                                                              |
|-------------------------|----------------------------------------------------------------------|
| `/`                     | Landing. Signed in → list of your rooms + "Create room". Out → Clerk |
| `/rooms/new`            | Form: name + deck. Creates room, redirects to `/r/[roomId]`.         |
| `/r/[roomId]`           | Main scrumpoker view. Three-pane layout.                             |
| `/r/[roomId]/history`   | Read-only: estimated stories with every round expanded.              |
| `/r/[roomId]/settings`  | Host-only: rename, change deck, archive, transfer host.              |

**REST endpoints (SvelteKit server routes):**

- `POST /api/rooms` — create
- `GET  /api/rooms/:id` — room metadata + members (gated by membership)
- `POST /api/rooms/:id/stories` — host only
- `PATCH /api/rooms/:id/stories/:storyId` — host only
- `POST /api/rooms/:id/stories/reorder` — host only
- `GET  /api/rooms/:id/history` — full round history
- `POST /api/rooms/:id/ws-ticket` — mints the short-lived room token described in §3
- `GET  /api/rooms/:id/ws` — upgrades to WebSocket; forwards to DO

## 6. Design system

The visual direction is a **"Modern TUI"**: terminal-app DNA (JetBrains Mono for data, dashed dividers, keyboard hints, status bar) with SaaS-grade polish (gradient surfaces, hairline highlights, refined motion). Black/dark-grey base, semantic accent colors. Selection signaled by size, not color (Mac-Dock-style card enlargement).

Reference mockups live in `.superpowers/brainstorm/` (untracked); the canonical room view is `visual-direction-merged-v11.html`, plus revealed/landing/history/settings screens.

### 6.1 Central token store

**All theme values live in one place** (`src/lib/theme/tokens.css`) as CSS custom properties, applied at the root via a `[data-theme]` attribute on `<html>`. Components consume tokens (`var(--surface-panel)`, `--accent-go`); **no component hardcodes a color, radius, shadow, or spacing value**. Swapping the theme is a single-file change. A future light mode is added by defining a second `[data-theme="light"]` block in the same file — no component changes required.

For Tailwind users (likely Tailwind v4 in this project), the token file doubles as the `@theme` source so Tailwind utilities resolve to the same vars (`bg-panel`, `text-accent-go`, etc.). Either system stays single-source.

### 6.2 Color tokens

Tokyo Night-derived dark palette over a true black canvas. Each token has a semantic role; never reference a color by hue.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0a0a0b` | Canvas |
| `--bg-2` | `#0f0f11` | Recessed surface (hero pane, inset wells) |
| `--panel` | `#141416` | Elevated panel (sidebars, cards) |
| `--panel-2` | `#1c1c1f` | Hover/active surface |
| `--panel-3` | `#26262a` | Highest elevation (avatars, card faces) |
| `--hairline` | `rgba(255,255,255,0.06)` | Default divider |
| `--hairline-strong` | `rgba(255,255,255,0.10)` | Emphasis divider, top-edge highlight |
| `--text` | `#d4d6dd` | Body |
| `--bright` | `#ffffff` | Headlines, host/you names |
| `--mid` | `#9ea0aa` | Secondary text |
| `--dim` | `#6e6e76` | Tertiary text, disabled |
| `--ink` | `#0a0a0b` | Text on saturated bg (deprecated for verdict pills) |
| `--accent-go` | `#2dd35f` | Primary action, consensus, voted, live |
| `--accent-go-bright` | `#46e57a` | `--accent-go` hover |
| `--accent-stop` | `#ef4444` | Destructive, no-consensus, errors |
| `--accent-amber` | `#e9b86b` | In-progress, voting, keycaps, round number |
| `--accent-cyan` | `#82d7ff` | Info, room slug, deck name, count chips |
| `--accent-mauve` | `#c4a7fa` | Host identity |
| `--accent-pink` | `#f57d96` | "You" identity |

**Verdict pills** use saturated background + white text (`--bright`), with a gradient (e.g. `linear-gradient(180deg, var(--accent-go-bright), var(--accent-go))`), inset top highlight, and color-tinted drop shadow. Same shape for `--accent-stop` (no-consensus) and `--accent-go` (consensus).

### 6.3 Typography tokens

| Token | Value | Role |
|---|---|---|
| `--font-sans` | `Inter, system-ui, sans-serif` | Body, headlines, prose |
| `--font-mono` | `JetBrains Mono, SF Mono, ui-monospace, monospace` | Data, numbers, key hints, slugs, mono labels |
| `--fs-display` | `30px` | Story title in hero |
| `--fs-h1` | `28-32px` | Page headers |
| `--fs-body` | `12.5px` | Default body |
| `--fs-small` | `11px` | Mono labels, status bar |
| `--fs-micro` | `10px` | Pane heads, all-caps tags |

**Numerics:** every number uses `font-variant-numeric: tabular-nums`. Inter is configured with feature settings `'ss01', 'cv11', 'tnum'`. Card face values are mono with `tnum`.

**Weights:** 500 baseline (Inter), 600 emphasis, 700-800 for headlines and labels. Bolder than typical SaaS.

### 6.4 Surface tokens

| Token | Value | Role |
|---|---|---|
| `--radius-sm` | `3.5px` | Keycaps, mini chips |
| `--radius-md` | `5-6px` | Buttons, cards in the deck, avatars |
| `--radius-lg` | `8-10px` | Panels, history strip, room cards |
| `--shadow-card` | `inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.4)` | Resting card |
| `--shadow-lift` | `inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 50px -8px rgba(0,0,0,0.85), 0 12px 22px rgba(0,0,0,0.5)` | Selected card |
| `--shadow-go` | `0 1px 0 inset rgba(255,255,255,0.2), 0 8px 18px -6px rgba(45,211,95,0.6), 0 2px 6px rgba(45,211,95,0.25)` | Primary button |

**Top-edge highlight pattern:** every elevated surface gets a `::before` pseudo-element with `linear-gradient(90deg, transparent, var(--hairline-strong), transparent)` at the top edge. Subtle but signals "this is a real surface".

### 6.5 Components

Components are Svelte 5 single-file components in `src/lib/components/`. Each consumes tokens; none hardcodes a color or radius. Minimum component set for v1:

- `Topbar` — wordmark + breadcrumb + nav + user pill
- `Statusbar` — keyboard affordance row
- `PaneHead` — `"── label ── [key]"` divider
- `Card` (story card / room card / settings card with optional `danger` variant)
- `Pcard` — playing card; props: `value`, `selected`, `revealed`, `consensus`
- `Chip` — vote chip; props: `voter`, `value`, `role`, `consensus`
- `Verdict` — pill; props: `kind: 'consensus' | 'no-consensus' | 'skipped' | 'pending'`
- `Avatar` — square; props: `initial`, `role: 'default' | 'host' | 'you'`
- `Button` — variants: `primary` (go-green gradient), `ghost`, `danger`, `danger-solid`
- `Keycap` — `[R]` keyboard hint
- `HistoryStrip` — round row with chips + summary

### 6.6 State-based mood

Visual mood shifts with room state, **using the same tokens**:

- **Voting** — amber-tinted glow at the top of the hero pane, amber accents on round tag and active story rail. Tighter, focused feel.
- **Revealed** — green-tinted glow, green accents on round tag and active story, green-tinted card shadows on consensus / pink-tinted on divergent. Softer, atmospheric feel.

This is achieved purely by switching the `--accent-current` token in the room layout based on round state, never by component-level overrides.

## 7. Room view UI

Three panes:

```
┌─────────────────────┬──────────────────────────────────┬────────────────┐
│ Stories             │   Current story                  │ Participants   │
│ ─────────           │   ─────────────                  │ ────────────   │
│ • Story A   ✓ 5     │   Title + description            │ ● Alice  voted │
│ • Story B   …       │                                  │ ● Bob    voted │
│ ▸ Story C   voting  │   [ 0 ][ 1 ][ 2 ][ 3 ][ 5 ][ 8 ] │ ○ Carol  …     │
│ • Story D           │   [13 ][21 ][ ? ][ ☕]           │ ● Dave   voted │
│                     │                                  │                │
│ + Add story         │   [ Reveal ]  [ Skip ]  (host)   │ Host: Alice    │
└─────────────────────┴──────────────────────────────────┴────────────────┘
```

### Interaction model

- **Anyone in the room** can: pick a card (sets their pre-reveal vote), change it freely until reveal, see *who* has voted but not *what*.
- **Host only** can: add / edit / reorder / delete stories, start voting on a story, reveal, accept an estimate, start a new round, skip, transfer host, kick.
- **On reveal:** cards flip simultaneously for everyone. Each person's value, the distribution, the median, and high/low are shown. Host either clicks **Accept** (locks `final_estimate`, story → `estimated`) or **Re-vote** (new round, cards clear).
- **On disconnect:** participant fades to "away" but their slot stays. Reconnect within ~5 min resumes seamlessly. Host disconnect does not pause the room; after >10 min of host absence the UI surfaces a "Claim host" button to the longest-connected member, which sends a `claim_host` message the DO accepts only while the absence threshold still holds.
- **Kick:** removes from current session only. The user can rejoin (their `room_members` row is preserved). Effectively a "boot from socket" action.

## 8. WebSocket protocol

JSON messages over a single WebSocket per client. The DO multiplexes by room.

### Client → server

| Type           | Payload                | Allowed for |
|----------------|------------------------|-------------|
| `vote`         | `{ value }`            | any member  |

**Semantics note:** `start_round` is how the host picks *which story* the room is voting on next; it always creates a fresh `vote_rounds` row (round_number = previous max + 1, or 1 if none). `revote` is host-only and only valid between `revealed` and `accept`/`skip` on the *currently-voting* story — it discards the just-revealed round (no `accepted_estimate`) and starts another round on the same story.
| `clear_vote`   | —                      | any member  |
| `ping`         | —                      | any member  |
| `start_round` | `{ storyId }`          | host        |
| `claim_host`  | —                      | any member (host-absent guard enforced server-side) |
| `reveal`       | —                      | host        |
| `accept`       | `{ value }`            | host        |
| `revote`       | —                      | host        |
| `skip`         | —                      | host        |
| `add_story`   | `{ title, description }` | host      |
| `update_story` | `{ storyId, title?, description? }` | host |
| `reorder`      | `{ storyIds: string[] }` | host      |
| `kick`         | `{ userId }`           | host        |
| `transfer_host` | `{ userId }`          | host        |

### Server → all clients in room

| Type           | Payload                                              |
|----------------|------------------------------------------------------|
| `state`        | Full snapshot (stories, current round, presence). Sent on join. |
| `presence`     | `{ userId, status }` for member joined/left/voted    |
| `round_started` | `{ storyId, roundId, roundNumber }`                 |
| `revealed`     | `{ roundId, votes: {userId: value}, stats }`         |
| `story_updated` | Updated story row                                   |
| `story_reordered` | `{ storyIds }`                                     |
| `host_changed` | `{ hostUserId }`                                     |
| `kicked`       | `{ userId }` (target client also receives this and closes) |
| `error`        | `{ code, message }`                                  |

All host-restricted message types are re-validated by the DO against the verified `role` in the room token. Clients never assert their own role.

## 9. Error handling

- **Unauthorized WS connection** (bad/expired token, non-member): server closes with code 4401.
- **Stale state** (client sends `vote` for a story that is no longer the current round): server replies `error { code: "stale" }` and pushes a fresh `state`.
- **DO eviction mid-round:** on reconnect, clients receive a fresh `state` snapshot. Any pre-reveal votes are lost; the host can re-collect by simply waiting for everyone to re-vote, or starting a new round.
- **D1 write failure on reveal:** the DO retries with exponential backoff up to 3 times, then surfaces `error { code: "persist_failed" }` to the host and keeps the round open in memory.
- **Concurrent host actions** (two hosts after a transfer race): DO serializes all writes; whichever message arrives first wins, the loser receives `error { code: "not_host" }`.

## 10. Testing approach

- **D1 layer:** unit tests against `better-sqlite3` with the production schema, covering round transitions and the accept/revote/skip lifecycle.
- **DO layer:** Cloudflare's `unstable_dev` / Miniflare for integration tests that open WebSockets and drive a full estimation round (join, vote, reveal, accept, re-vote, history).
- **SvelteKit routes:** standard Vitest component + server tests; auth gating tested with mocked Clerk session.
- **End-to-end:** Playwright over the deployed preview environment with two browser contexts simulating two team members.

## 11. Deployment

- Single `wrangler.toml` with bindings: D1 (`DB`), Durable Object namespace (`ROOM`).
- `wrangler d1 migrations` for schema management; migrations live in `migrations/`.
- Secrets via `wrangler secret put`: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `ROOM_TOKEN_SECRET`.
- CI: GitHub Actions runs typecheck + tests + `wrangler deploy --dry-run` on PR; deploys on merge to `main`.

## 12. Open questions

None blocking. Items deferred to post-v1:

- Story import from Jira/Linear URLs.
- Per-user notification when it's "your turn".
- Export room history to CSV.
- Mobile-optimized layout.
