# planpokr

Team planning-poker webapp. Deployed at [planpokr.com](https://planpokr.com).

## Stack

- SvelteKit on Cloudflare Workers (`@sveltejs/adapter-cloudflare`)
- Room Durable Object (hibernatable WebSockets) for per-room live state
- D1 for users, rooms, stories, vote rounds, votes
- Clerk for auth (room-scoped HMAC JWT minted by the Worker)
- Tailwind v4 with `@theme` driving CSS custom properties

## Design system

Every design token lives in `src/lib/theme/tokens.css`. Re-skin the whole app by editing that one file. No component hardcodes a color, radius, or shadow.

## Local development

```bash
pnpm i
cp .dev.vars.example .dev.vars         # Wrangler runtime secrets
cp .env.local.example .env.local       # SvelteKit/Vite (PUBLIC_* Clerk config)
# fill in Clerk keys + a fresh ROOM_TOKEN_SECRET in both files
pnpm db:migrate:local
pnpm dev
```

Open <http://localhost:5173>. Sign in via Clerk, create a room, share the room URL with a teammate (or open a second browser tab as a different Clerk user).

### `vite dev` vs `wrangler dev`

`pnpm dev` runs Vite, which is fast but **does not run the `RoomDO` Durable Object**. Auth, the home/about/sign-in pages, and D1-backed REST endpoints all work, but inside a room the WebSocket connection will fail and the footer will stay on `connecting…` forever (the `RoomDO` binding warns at startup that it isn't available locally).

To exercise the live room features (voting, reveal, accept, presence) locally, build first and use Wrangler's dev server, which runs the real Worker + DO via `workerd`:

```bash
pnpm build
pnpm dlx wrangler dev
```

Iteration is slower (rebuild after each change) but everything works. Alternatively, just test room features against the deployed `planpokr.com`.

### Environment files

Two env files are needed for local dev — both are gitignored.

**`.dev.vars`** — read by Wrangler at runtime (Worker + Durable Object). Server-only secrets.

```
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
ROOM_TOKEN_SECRET=<openssl rand -hex 32>
```

**`.env.local`** — read by SvelteKit/Vite at build & dev time. `PUBLIC_*` vars are exposed to the browser bundle, so this is where the Clerk client config lives.

```
CLERK_SECRET_KEY=sk_test_...
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
PUBLIC_CLERK_SIGN_IN_URL=/sign-in
PUBLIC_CLERK_SIGN_UP_URL=/sign-up
PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/
PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/
PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

Get the Clerk keys from your Clerk dashboard (Developers → API Keys). `ROOM_TOKEN_SECRET` is local-only — any 32-byte hex string works.

## Tests

```bash
pnpm test        # vitest unit tests
pnpm test:e2e    # playwright (requires `pnpm build` first)
pnpm check       # svelte-check
```

## Deploy

```bash
# One-time: create the D1 database and paste the printed UUID into wrangler.toml
pnpm dlx wrangler d1 create planpokr

# One-time: set production secrets
pnpm dlx wrangler secret put CLERK_SECRET_KEY
pnpm dlx wrangler secret put CLERK_PUBLISHABLE_KEY
pnpm dlx wrangler secret put ROOM_TOKEN_SECRET   # value: openssl rand -hex 32

# Each release
pnpm db:migrate:prod
pnpm build
pnpm deploy
```

Custom domain: Cloudflare dashboard → Workers → planpokr → Triggers → Custom Domains → add `planpokr.com`.

## Architecture (one paragraph)

A single Cloudflare Worker hosts both the SvelteKit app and the `RoomDO` Durable Object class. The Worker handles HTML, REST endpoints, Clerk session verification, and minting short-lived HMAC tokens that scope a WebSocket connection to a specific `(user, room, role)`. The DO holds in-memory state per room (current round, pre-reveal votes, presence) and broadcasts via the hibernatable WebSocket API. Pre-reveal votes live in memory only; on `reveal` the DO flushes votes to D1, which stores the durable history (every round, every vote, every accepted estimate). On `accept` the DO updates the story's `final_estimate` and the round's `accepted_estimate`. Re-voting starts a new `vote_rounds` row so the audit trail is complete.

## File layout

- `src/lib/theme/tokens.css` — single source of truth for all design tokens
- `src/lib/components/` — reusable Svelte 5 components (Pcard, Chip, Verdict, Topbar, etc.)
- `src/lib/server/` — server-only modules (db helpers, auth, slug)
- `src/lib/do/` — Durable Object (`RoomDO.ts`), message types, state shapes
- `src/lib/ws/client.ts` — browser WebSocket store
- `src/lib/stats.ts` — pure stats computation, shared by DO + history page
- `src/lib/decks.ts` — deck definitions (Fibonacci, T-shirt)
- `src/routes/` — SvelteKit pages + API endpoints
- `migrations/` — D1 schema
- `tests/unit/` — Vitest
- `tests/e2e/` — Playwright
- `docs/superpowers/specs/` — design spec
- `docs/superpowers/plans/` — implementation plan

## Design spec & implementation plan

- [`docs/superpowers/specs/2026-05-13-scrumpoker-design.md`](docs/superpowers/specs/2026-05-13-scrumpoker-design.md)
- [`docs/superpowers/plans/2026-05-13-planpokr-implementation.md`](docs/superpowers/plans/2026-05-13-planpokr-implementation.md)
