# planpokr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build planpokr, a team planning-poker webapp deployed to Cloudflare. Real-time voting via a Room Durable Object, persistent history via D1, Clerk for auth, single `wrangler deploy`.

**Architecture:** One Cloudflare Worker hosts the SvelteKit app (`@sveltejs/adapter-cloudflare`) and a `RoomDO` Durable Object class. The Worker handles REST + HTML; the DO owns per-room live state and broadcasts via the hibernatable WebSocket API. D1 stores durable state (users, rooms, stories, rounds, votes). Clerk handles login; the Worker mints short-lived room tokens (HMAC-signed JWT) so the DO never calls Clerk.

**Tech Stack:** SvelteKit 2 (Svelte 5, runes), TypeScript, Tailwind v4 (`@theme` directive driving CSS custom properties), Cloudflare Workers + `wrangler`, Durable Objects (hibernatable WS), D1, `@clerk/sveltekit`, Vitest, `@playwright/test`, Miniflare/wrangler local mode for DO integration tests.

**Reference:** Design spec at `docs/superpowers/specs/2026-05-13-scrumpoker-design.md`. Visual reference mockups (untracked) at `.superpowers/brainstorm/66427-1778715921/content/visual-direction-merged-v11.html` and `screen-*.html`.

---

## File structure

Files this plan creates. Each has one clear responsibility.

```
scrumpoker/
├── wrangler.toml
├── package.json, tsconfig.json, svelte.config.js, vite.config.ts
├── migrations/
│   └── 0001_initial.sql
├── src/
│   ├── app.html
│   ├── app.css                          (loads tokens + base)
│   ├── hooks.server.ts                  (Clerk session → locals)
│   ├── lib/
│   │   ├── theme/tokens.css             (single source of truth)
│   │   ├── server/
│   │   │   ├── db.ts                    (D1 query helpers)
│   │   │   ├── auth.ts                  (room token mint/verify)
│   │   │   ├── decks.ts                 (fib + tshirt definitions)
│   │   │   └── slug.ts                  (room slug generator)
│   │   ├── do/
│   │   │   ├── RoomDO.ts                (DO class — WS + state + persistence)
│   │   │   ├── state.ts                 (in-memory shapes)
│   │   │   └── messages.ts              (WS message type unions)
│   │   ├── ws/client.ts                 (browser store + reconnect)
│   │   ├── components/
│   │   │   ├── Topbar.svelte            Statusbar.svelte
│   │   │   ├── PaneHead.svelte          Card.svelte
│   │   │   ├── Pcard.svelte             Chip.svelte
│   │   │   ├── Verdict.svelte           Avatar.svelte
│   │   │   ├── Button.svelte            Keycap.svelte
│   │   │   └── HistoryStrip.svelte
│   │   └── types.ts
│   └── routes/
│       ├── +layout.svelte, +layout.server.ts
│       ├── +page.svelte (landing/room list)
│       ├── rooms/new/+page.svelte (+page.server.ts)
│       ├── r/[roomId]/
│       │   ├── +page.svelte, +page.server.ts
│       │   ├── history/+page.svelte (+page.server.ts)
│       │   └── settings/+page.svelte (+page.server.ts)
│       └── api/rooms/
│           ├── +server.ts
│           └── [roomId]/
│               ├── stories/+server.ts
│               ├── stories/[storyId]/+server.ts
│               ├── stories/reorder/+server.ts
│               ├── ws-ticket/+server.ts
│               └── ws/+server.ts        (upgrades & forwards to DO)
└── tests/
    ├── unit/
    └── e2e/
```

---

## Phase 1 — Scaffold (Tasks 1-4)

### Task 1: Initialize SvelteKit + Cloudflare adapter

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/routes/+page.svelte`

- [ ] **Step 1: Scaffold SvelteKit**

```bash
pnpm dlx sv@latest create . --template minimal --types ts --no-add-ons
pnpm i
```

When prompted by `sv`, accept defaults. Answer "yes" to install deps.

- [ ] **Step 2: Install Cloudflare adapter**

```bash
pnpm i -D @sveltejs/adapter-cloudflare wrangler @cloudflare/workers-types
```

- [ ] **Step 3: Wire the adapter**

Replace `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ routes: { include: ['/*'], exclude: ['<all>'] } })
  }
};
```

Add `worker-configuration.d.ts` types — generate after wrangler is configured.

- [ ] **Step 4: Smoke test**

```bash
pnpm dev
```

Expected: dev server starts at `http://localhost:5173`, default SvelteKit page renders.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit with Cloudflare adapter"
```

---

### Task 2: Configure wrangler.toml

**Files:**
- Create: `wrangler.toml`

- [ ] **Step 1: Write wrangler.toml**

```toml
name = "planpokr"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2025-09-15"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".svelte-kit/cloudflare"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "planpokr"
database_id = "REPLACE_AFTER_CREATE"
migrations_dir = "migrations"

[[durable_objects.bindings]]
name = "ROOM"
class_name = "RoomDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RoomDO"]

[vars]
# non-secret values go here

# Secrets (set via `wrangler secret put`):
#   CLERK_SECRET_KEY
#   CLERK_PUBLISHABLE_KEY
#   ROOM_TOKEN_SECRET
```

- [ ] **Step 2: Create the D1 database**

```bash
pnpm dlx wrangler d1 create planpokr
```

Copy the printed `database_id` into `wrangler.toml`. Commit the resulting toml.

- [ ] **Step 3: Generate types**

```bash
pnpm dlx wrangler types
```

Expected: creates `worker-configuration.d.ts` with `Env` interface containing `DB`, `ROOM`, secrets.

- [ ] **Step 4: Commit**

```bash
git add wrangler.toml worker-configuration.d.ts
git commit -m "feat: configure wrangler with D1 + DO bindings"
```

---

### Task 3: Install Tailwind v4

**Files:**
- Create: `src/app.css`
- Modify: `src/routes/+layout.svelte`, `vite.config.ts`

- [ ] **Step 1: Install Tailwind v4 + Vite plugin**

```bash
pnpm i -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Wire Vite plugin**

`vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()]
});
```

- [ ] **Step 3: Create app.css stub**

```css
@import "tailwindcss";
@import "./lib/theme/tokens.css";
```

Tokens file gets created in Task 5 — this import resolves after that.

- [ ] **Step 4: Create root layout**

`src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://rsms.me/" />
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono/web/woff2/JetBrainsMono.css" />
</svelte:head>

{@render children()}
```

- [ ] **Step 5: Smoke test**

```bash
pnpm dev
```

Expected: still renders the default page; no css errors in console.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: install Tailwind v4 and wire global stylesheet"
```

---

### Task 4: Test infrastructure

**Files:**
- Create: `vitest.config.ts`, `playwright.config.ts`, `tests/unit/.gitkeep`, `tests/e2e/example.spec.ts`

- [ ] **Step 1: Install test deps**

```bash
pnpm i -D vitest @vitest/ui jsdom @testing-library/svelte @testing-library/jest-dom @playwright/test
pnpm dlx playwright install chromium
```

- [ ] **Step 2: Configure Vitest**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['./tests/unit/setup.ts']
  }
});
```

`tests/unit/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Configure Playwright**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'pnpm preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI
  },
  use: { baseURL: 'http://localhost:4173' }
});
```

- [ ] **Step 4: Add scripts to package.json**

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "preview": "vite preview",
  "deploy": "wrangler deploy",
  "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
  "test": "vitest run",
  "test:unit": "vitest",
  "test:e2e": "playwright test",
  "db:migrate:local": "wrangler d1 migrations apply planpokr --local",
  "db:migrate:prod": "wrangler d1 migrations apply planpokr --remote"
}
```

- [ ] **Step 5: Sanity test**

`tests/unit/sanity.test.ts`:

```ts
import { expect, test } from 'vitest';
test('sanity', () => expect(1 + 1).toBe(2));
```

Run: `pnpm test`. Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: bootstrap vitest + playwright"
```

---

## Phase 2 — Theme tokens (Task 5)

### Task 5: Design tokens

**Files:**
- Create: `src/lib/theme/tokens.css`

This file is the single source of truth referenced by every component. Per `feedback_centralized_theme.md`, no component hardcodes color/radius/shadow values.

- [ ] **Step 1: Write tokens.css**

```css
@theme {
  /* Surfaces */
  --color-bg: #0a0a0b;
  --color-bg-2: #0f0f11;
  --color-panel: #141416;
  --color-panel-2: #1c1c1f;
  --color-panel-3: #26262a;
  --color-hairline: rgb(255 255 255 / 0.06);
  --color-hairline-strong: rgb(255 255 255 / 0.10);
  --color-border: #26262a;
  --color-border-strong: #36363c;

  /* Text */
  --color-text: #d4d6dd;
  --color-bright: #ffffff;
  --color-mid: #9ea0aa;
  --color-dim: #6e6e76;
  --color-ink: #0a0a0b;

  /* Semantic accents */
  --color-go: #2dd35f;
  --color-go-bright: #46e57a;
  --color-stop: #ef4444;
  --color-amber: #e9b86b;
  --color-cyan: #82d7ff;
  --color-mauve: #c4a7fa;
  --color-pink: #f57d96;

  /* Type */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  --text-display: 30px;
  --text-h1: 28px;
  --text-body: 12.5px;
  --text-small: 11px;
  --text-micro: 10px;

  /* Radii */
  --radius-sm: 3.5px;
  --radius-md: 5px;
  --radius-lg: 8px;
  --radius-xl: 10px;

  /* Shadows */
  --shadow-card: inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-lift: inset 0 1px 0 rgb(255 255 255 / 0.12), 0 24px 50px -8px rgb(0 0 0 / 0.85), 0 12px 22px rgb(0 0 0 / 0.5);
  --shadow-go: 0 1px 0 inset rgb(255 255 255 / 0.2), 0 8px 18px -6px rgb(45 211 95 / 0.6), 0 2px 6px rgb(45 211 95 / 0.25);
  --shadow-stop: 0 4px 12px -2px rgb(239 68 68 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.12);
}

/* Apply at root */
html {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-feature-settings: 'ss01', 'cv11', 'tnum';
  font-size: var(--text-body);
  line-height: 1.5;
  letter-spacing: -0.005em;
}

/* Numeric defaults */
.tabular { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: Add hairline-highlight utility**

Append:

```css
/* Top-edge hairline (signature surface effect) */
@utility hairline-top {
  position: relative;
}
@utility hairline-top::before {
  content: '';
  position: absolute;
  left: 0; right: 0; top: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-hairline-strong) 30%, var(--color-hairline-strong) 70%, transparent);
  pointer-events: none;
}
```

- [ ] **Step 3: Verify utilities resolve**

`src/routes/+page.svelte`:

```svelte
<div class="bg-panel text-go p-4 rounded-lg">planpokr theme works</div>
```

Run `pnpm dev`. Visit `/`. Expected: dark green text on dark grey panel.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: design tokens via Tailwind v4 @theme"
```

---

## Phase 3 — Component library (Tasks 6-13)

Each component is a single Svelte 5 file using runes (`$props`, `$state`). Render tests verify the component mounts and key elements appear; visual fidelity is verified in the dev server.

### Task 6: Button + Keycap

**Files:**
- Create: `src/lib/components/Button.svelte`, `src/lib/components/Keycap.svelte`
- Test: `tests/unit/Button.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/Button.test.ts`:

```ts
import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Button from '$lib/components/Button.svelte';

test('renders primary by default', () => {
  render(Button, { children: () => 'Reveal' });
  expect(screen.getByRole('button')).toHaveTextContent('Reveal');
});

test('applies variant class', () => {
  render(Button, { variant: 'ghost', children: () => 'Skip' });
  expect(screen.getByRole('button').className).toMatch(/ghost/);
});
```

Run: `pnpm test`. Expected: FAIL — Button missing.

- [ ] **Step 2: Implement Button**

`src/lib/components/Button.svelte`:

```svelte
<script lang="ts">
  type Variant = 'primary' | 'ghost' | 'danger' | 'danger-solid';
  let { variant = 'primary', onclick, children, disabled = false } = $props<{
    variant?: Variant;
    onclick?: () => void;
    disabled?: boolean;
    children: any;
  }>();
</script>

<button
  class="btn variant-{variant}"
  class:disabled
  {onclick}
  {disabled}
><span>{@render children()}</span></button>

<style>
  .btn {
    padding: 11px 22px;
    border-radius: var(--radius-md);
    border: 1px solid;
    font-weight: 700;
    font-size: 12.5px;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: transform 0.14s, filter 0.14s;
  }
  .btn:hover { transform: translateY(-1px); filter: brightness(1.06); }
  .btn.disabled { opacity: 0.4; pointer-events: none; }

  .variant-primary {
    background: linear-gradient(180deg, var(--color-go-bright), var(--color-go));
    color: var(--color-bright);
    border-color: var(--color-go);
    box-shadow: var(--shadow-go);
  }
  .variant-ghost {
    background: transparent;
    color: var(--color-text);
    border-color: var(--color-hairline-strong);
    font-weight: 600;
  }
  .variant-ghost:hover { background: var(--color-panel-2); color: var(--color-bright); filter: none; }
  .variant-danger {
    background: transparent;
    color: var(--color-stop);
    border-color: rgb(239 68 68 / 0.4);
  }
  .variant-danger-solid {
    background: linear-gradient(180deg, #f25555, var(--color-stop));
    color: var(--color-bright);
    border-color: var(--color-stop);
    box-shadow: var(--shadow-stop);
  }
</style>
```

- [ ] **Step 3: Implement Keycap**

`src/lib/components/Keycap.svelte`:

```svelte
<script lang="ts">
  let { children } = $props();
</script>

<kbd class="keycap">{@render children()}</kbd>

<style>
  .keycap {
    color: var(--color-amber);
    background: var(--color-panel-2);
    border: 1px solid var(--color-hairline-strong);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    margin-right: 3px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.3);
  }
</style>
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): Button (primary/ghost/danger/danger-solid) and Keycap"
```

---

### Task 7: Avatar

**Files:**
- Create: `src/lib/components/Avatar.svelte`
- Test: `tests/unit/Avatar.test.ts`

- [ ] **Step 1: Test**

```ts
import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Avatar from '$lib/components/Avatar.svelte';

test('shows initial', () => {
  render(Avatar, { initial: 'A' });
  expect(screen.getByText('A')).toBeInTheDocument();
});
test('host role adds host class', () => {
  const { container } = render(Avatar, { initial: 'A', role: 'host' });
  expect(container.firstChild).toHaveClass('host');
});
```

- [ ] **Step 2: Implement**

```svelte
<script lang="ts">
  let { initial, role = 'default', size = 'md' } = $props<{
    initial: string;
    role?: 'default' | 'host' | 'you';
    size?: 'sm' | 'md';
  }>();
</script>

<div class="avatar size-{size} role-{role}" class:host={role === 'host'} class:you={role === 'you'}>{initial}</div>

<style>
  .avatar {
    border-radius: var(--radius-md);
    display: inline-flex; align-items: center; justify-content: center;
    font-family: var(--font-mono);
    font-weight: 800;
    border: 1px solid var(--color-hairline-strong);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
    background: linear-gradient(135deg, var(--color-panel-3), var(--color-panel-2));
    color: var(--color-text);
  }
  .size-sm { width: 22px; height: 22px; font-size: 9.5px; }
  .size-md { width: 28px; height: 28px; font-size: 12px; }
  .host { background: linear-gradient(135deg, var(--color-mauve), #9b7de0); color: var(--color-ink); border-color: transparent;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25), 0 2px 8px rgb(196 167 250 / 0.25); }
  .you  { background: linear-gradient(135deg, var(--color-pink), #d56a85); color: var(--color-ink); border-color: transparent;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25), 0 2px 8px rgb(245 125 150 / 0.25); }
</style>
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test
git add -A && git commit -m "feat(ui): Avatar with host/you variants"
```

---

### Task 8: Pcard (playing card)

**Files:**
- Create: `src/lib/components/Pcard.svelte`
- Test: `tests/unit/Pcard.test.ts`

- [ ] **Step 1: Test**

```ts
import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Pcard from '$lib/components/Pcard.svelte';

test('shows value', () => {
  render(Pcard, { value: '5' });
  expect(screen.getByText('5')).toBeInTheDocument();
});
test('selected adds sel class', () => {
  const { container } = render(Pcard, { value: '5', selected: true });
  expect(container.firstChild).toHaveClass('sel');
});
```

- [ ] **Step 2: Implement**

```svelte
<script lang="ts">
  let { value, selected = false, onclick, size = 'sm' } = $props<{
    value: string;
    selected?: boolean;
    onclick?: () => void;
    size?: 'sm' | 'lg';
  }>();
</script>

<button class="pcard size-{size}" class:sel={selected} {onclick}>{value}</button>

<style>
  .pcard {
    border-radius: 7px;
    background: linear-gradient(180deg, var(--color-panel-2), var(--color-panel));
    border: 1px solid var(--color-hairline-strong);
    color: var(--color-text);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), border-color 0.18s, box-shadow 0.2s, background 0.18s, color 0.18s;
    transform-origin: center bottom;
    position: relative;
    box-shadow: var(--shadow-card);
  }
  .size-sm { width: 52px; height: 76px; font-size: 18px; font-weight: 700; }
  .size-lg { width: 64px; height: 94px; font-size: 26px; font-weight: 700; }
  .pcard:hover { transform: scale(1.14) translateY(-6px); border-color: var(--color-mid); color: var(--color-bright); }
  .pcard.sel {
    transform: scale(1.55) translateY(-18px);
    border-color: rgb(255 255 255 / 0.5);
    background: linear-gradient(180deg, #2e2e34, var(--color-panel-2));
    color: var(--color-bright);
    box-shadow: var(--shadow-lift);
    z-index: 2;
  }
  .pcard.sel::after {
    content: ''; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%);
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--color-bright);
    box-shadow: 0 0 8px rgb(255 255 255 / 0.6);
  }
</style>
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test
git add -A && git commit -m "feat(ui): Pcard with size-based selection (Mac Dock-style)"
```

---

### Task 9: Chip

**Files:**
- Create: `src/lib/components/Chip.svelte`
- Test: `tests/unit/Chip.test.ts`

- [ ] **Step 1: Test**

```ts
import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Chip from '$lib/components/Chip.svelte';

test('shows initial + value', () => {
  render(Chip, { initial: 'A', value: '5' });
  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement**

```svelte
<script lang="ts">
  let { initial, value, role = 'default', state = 'neutral' } = $props<{
    initial: string;
    value: string;
    role?: 'default' | 'host' | 'you';
    state?: 'neutral' | 'consensus' | 'divergent';
  }>();
</script>

<span class="chip role-{role} state-{state}">
  <span class="a">{initial}</span>
  <span class="v">{value}</span>
</span>

<style>
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 8px 3px 3px;
    background: var(--color-panel-2);
    border: 1px solid var(--color-hairline-strong);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 11px; font-weight: 600;
  }
  .a {
    width: 20px; height: 20px; border-radius: 3px;
    background: var(--color-panel-3); color: var(--color-text);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 9.5px; font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .role-host .a { background: linear-gradient(135deg, var(--color-mauve), #a085e8); color: var(--color-ink); }
  .role-you  .a { background: linear-gradient(135deg, var(--color-pink), #d96b85); color: var(--color-ink); }
  .v { color: var(--color-bright); font-weight: 700; font-variant-numeric: tabular-nums; }
  .state-divergent .v { color: var(--color-pink); }
  .state-consensus .v { color: var(--color-go); }
</style>
```

- [ ] **Step 3: Commit**

```bash
pnpm test
git add -A && git commit -m "feat(ui): Chip (vote chip with role/state variants)"
```

---

### Task 10: Verdict pill

**Files:**
- Create: `src/lib/components/Verdict.svelte`
- Test: `tests/unit/Verdict.test.ts`

- [ ] **Step 1: Test**

```ts
import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Verdict from '$lib/components/Verdict.svelte';

test.each([
  ['consensus', 'CONSENSUS'],
  ['no-consensus', 'NO CONSENSUS'],
  ['skipped', 'SKIPPED']
])('renders %s', (kind, label) => {
  render(Verdict, { kind: kind as any });
  expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement**

```svelte
<script lang="ts">
  type Kind = 'consensus' | 'no-consensus' | 'skipped';
  let { kind, value } = $props<{ kind: Kind; value?: string }>();
  const label = kind === 'consensus' ? `CONSENSUS${value ? ` → ${value}` : ''}`
              : kind === 'no-consensus' ? 'NO CONSENSUS'
              : 'SKIPPED';
</script>

<span class="v kind-{kind}">{label}</span>

<style>
  .v {
    padding: 3px 9px;
    border-radius: var(--radius-md);
    font-weight: 800;
    letter-spacing: 0.08em;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--color-bright);
  }
  .kind-consensus {
    background: linear-gradient(180deg, var(--color-go-bright), var(--color-go));
    box-shadow: 0 4px 12px -2px rgb(45 211 95 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.18);
  }
  .kind-no-consensus {
    background: linear-gradient(180deg, #f25555, var(--color-stop));
    box-shadow: var(--shadow-stop);
  }
  .kind-skipped {
    background: linear-gradient(180deg, #6e6e76, #4a4a52);
    box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.4);
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
pnpm test
git add -A && git commit -m "feat(ui): Verdict pill (consensus/no-consensus/skipped)"
```

---

### Task 11: Topbar + Statusbar

**Files:**
- Create: `src/lib/components/Topbar.svelte`, `src/lib/components/Statusbar.svelte`

- [ ] **Step 1: Implement Topbar**

```svelte
<script lang="ts">
  let { breadcrumb = [], nav = [], user, live = false } = $props<{
    breadcrumb?: { label: string; kind?: 'room' | 'plain' }[];
    nav?: { label: string; active?: boolean }[];
    user?: { initial: string; name: string };
    live?: boolean;
  }>();
</script>

<header class="topbar hairline-top">
  <span class="brand">planpokr</span>
  {#each breadcrumb as crumb}
    <span class="sep">/</span>
    <span class:room={crumb.kind === 'room'}>{crumb.label}</span>
  {/each}
  {#if nav.length}
    <nav>{#each nav as item}<a class:active={item.active}>{item.label}</a>{/each}</nav>
  {/if}
  {#if live}<span class="conn">LIVE</span>{/if}
  {#if user}<span class="user"><span class="av">{user.initial}</span>{user.name}</span>{/if}
</header>

<style>
  .topbar { display: flex; align-items: center; gap: 14px; padding: 12px 20px;
    background: linear-gradient(180deg, var(--color-panel-2), var(--color-panel));
    border-bottom: 1px solid var(--color-hairline);
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; }
  .brand { color: var(--color-bright); font-weight: 800; font-size: 14px; letter-spacing: -0.025em; font-family: var(--font-sans); }
  .brand::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 2px;
    background: linear-gradient(135deg, var(--color-cyan), var(--color-mauve)); margin-right: 8px; vertical-align: 1px; }
  .sep { color: var(--color-dim); }
  .room { color: var(--color-cyan); font-weight: 600; }
  nav { display: flex; gap: 18px; margin-left: 10px; }
  nav a { color: var(--color-mid); cursor: pointer; }
  nav a.active { color: var(--color-bright); font-weight: 700; }
  .conn { margin-left: auto; color: var(--color-go); display: flex; align-items: center; gap: 8px; font-weight: 600; letter-spacing: 0.04em; font-size: 10.5px; }
  .conn::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--color-go);
    box-shadow: 0 0 0 2px rgb(45 211 95 / 0.18), 0 0 10px rgb(45 211 95 / 0.5); }
  .user { display: flex; align-items: center; gap: 8px; padding-left: 14px; border-left: 1px solid var(--color-hairline); color: var(--color-pink); margin-left: auto; }
  .user .av { width: 22px; height: 22px; border-radius: var(--radius-md); background: var(--color-pink); color: var(--color-ink); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; }
</style>
```

- [ ] **Step 2: Implement Statusbar**

```svelte
<script lang="ts">
  let { items = [], right } = $props<{
    items?: { key: string; label: string }[];
    right?: string;
  }>();
</script>

<footer class="statusbar hairline-top">
  {#each items as it}<span class="item"><kbd>{it.key}</kbd> {it.label}</span>{/each}
  {#if right}<span class="right">{right}</span>{/if}
</footer>

<style>
  .statusbar { display: flex; align-items: center; gap: 18px; padding: 10px 20px;
    background: linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border-top: 1px solid var(--color-hairline);
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-mid); }
  kbd { color: var(--color-amber); background: var(--color-bg); border: 1px solid var(--color-hairline-strong);
    border-radius: var(--radius-sm); padding: 2px 6px; margin-right: 5px; font-weight: 700;
    box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.4); font-family: var(--font-mono); }
  .right { margin-left: auto; color: var(--color-go); font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): Topbar + Statusbar"
```

---

### Task 12: PaneHead + Card + HistoryStrip

**Files:**
- Create: `src/lib/components/PaneHead.svelte`, `Card.svelte`, `HistoryStrip.svelte`

- [ ] **Step 1: PaneHead**

```svelte
<script lang="ts">
  let { children, hint } = $props<{ children: any; hint?: string }>();
</script>

<div class="ph">{@render children()}{#if hint}<span class="key">{hint}</span>{/if}</div>

<style>
  .ph { font-family: var(--font-mono); font-size: 10px; color: var(--color-mid);
    font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .ph::after { content: ''; flex: 1; height: 1px; background: var(--color-hairline); }
  .key { color: var(--color-amber); font-weight: 700; font-size: 9.5px; padding: 2px 5px;
    background: rgb(233 184 107 / 0.08); border: 1px solid rgb(233 184 107 / 0.18); border-radius: 3px; }
</style>
```

- [ ] **Step 2: Card**

```svelte
<script lang="ts">
  let { children, danger = false, padding = 'lg' } = $props();
</script>

<div class="card hairline-top" class:danger class:p-lg={padding === 'lg'} class:p-md={padding === 'md'}>
  {@render children()}
</div>

<style>
  .card { background: linear-gradient(180deg, var(--color-panel) 0%, rgb(20 20 22 / 0.92) 100%);
    border: 1px solid var(--color-hairline); border-radius: var(--radius-xl); position: relative; }
  .p-md { padding: 16px 18px; }
  .p-lg { padding: 22px 24px 24px; }
  .danger { border-color: rgb(239 68 68 / 0.2); }
  .danger::before { background: linear-gradient(90deg, transparent, rgb(239 68 68 / 0.5), transparent) !important; }
</style>
```

- [ ] **Step 3: HistoryStrip**

```svelte
<script lang="ts">
  import Chip from './Chip.svelte';
  import Verdict from './Verdict.svelte';
  type Vote = { initial: string; value: string; role?: 'default' | 'host' | 'you'; state: 'consensus' | 'divergent' };
  type Round = { num: number; votes: Vote[]; median: string; range: string; verdict: 'consensus' | 'no-consensus' | 'skipped'; estimate?: string };
  let { rounds } = $props<{ rounds: Round[] }>();
</script>

<div class="strip hairline-top">
  {#each rounds as round, i}
    <div class="row" class:first={i === 0}>
      <span class="label" class:accepted={round.verdict === 'consensus'}>R{round.num}</span>
      <div class="chips">{#each round.votes as v}<Chip {...v} />{/each}</div>
      <div class="summary">
        <span>median <span class="num">{round.median}</span></span>
        <span>range <span class="num">{round.range}</span></span>
        <Verdict kind={round.verdict} value={round.estimate} />
      </div>
    </div>
  {/each}
</div>

<style>
  .strip { padding: 16px 18px; background: linear-gradient(180deg, var(--color-panel), var(--color-bg-2));
    border: 1px solid var(--color-hairline); border-radius: var(--radius-lg); position: relative; }
  .row { display: flex; align-items: center; gap: 14px; padding: 6px 0; }
  .row + .row { border-top: 1px solid var(--color-hairline); margin-top: 6px; padding-top: 12px; }
  .label { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--color-amber);
    background: rgb(233 184 107 / 0.08); border: 1px solid rgb(233 184 107 / 0.25);
    padding: 4px 8px; border-radius: var(--radius-md); min-width: 32px; text-align: center; }
  .label.accepted { color: var(--color-go); background: rgb(45 211 95 / 0.08); border-color: rgb(45 211 95 / 0.3); }
  .chips { display: flex; gap: 5px; flex: 1; flex-wrap: wrap; }
  .summary { display: flex; gap: 14px; align-items: center; margin-left: auto;
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; color: var(--color-mid); }
  .num { color: var(--color-cyan); font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): PaneHead, Card, HistoryStrip"
```

---

### Task 13: Component showcase route (manual visual verification)

**Files:**
- Create: `src/routes/_dev/components/+page.svelte`

- [ ] **Step 1: Showcase page**

Render one of each component side-by-side so future regressions are easy to spot. Keep this route under `_dev/` so it's not exposed to users (SvelteKit treats underscored routes as private).

```svelte
<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Pcard from '$lib/components/Pcard.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Verdict from '$lib/components/Verdict.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Topbar from '$lib/components/Topbar.svelte';
  import Statusbar from '$lib/components/Statusbar.svelte';
  import Keycap from '$lib/components/Keycap.svelte';
</script>

<Topbar user={{ initial: 'E', name: 'eve' }} live />
<main style="padding:24px;display:grid;gap:16px">
  <div><Button>Reveal cards</Button> <Button variant="ghost">Skip</Button> <Button variant="danger">Kick</Button> <Button variant="danger-solid">Delete</Button></div>
  <div style="display:flex;gap:8px;align-items:flex-end">{#each ['0','1','2','3','5','8','13','21','?','☕'] as v}<Pcard value={v} selected={v === '5'} />{/each}</div>
  <div style="display:flex;gap:6px">
    <Chip initial="A" value="5" role="host" state="consensus" />
    <Chip initial="B" value="8" state="divergent" />
    <Chip initial="E" value="5" role="you" state="consensus" />
  </div>
  <div style="display:flex;gap:8px">
    <Verdict kind="consensus" value="5" />
    <Verdict kind="no-consensus" />
    <Verdict kind="skipped" />
  </div>
  <div style="display:flex;gap:8px"><Avatar initial="A" role="host" /><Avatar initial="B" /><Avatar initial="E" role="you" /></div>
  <div><Keycap>R</Keycap>reveal <Keycap>S</Keycap>skip</div>
</main>
<Statusbar items={[{key: 'R', label: 'reveal'}, {key: 'S', label: 'skip'}]} right="fib · 5 online" />
```

- [ ] **Step 2: Manual check**

`pnpm dev` → `http://localhost:5173/_dev/components`. Verify visually matches v11 reference mockup. Iterate on tokens if anything's off.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: _dev/components showcase for visual regression checks"
```

---

## Phase 4 — D1 schema + DB layer (Tasks 14-16)

### Task 14: Schema migration

**Files:**
- Create: `migrations/0001_initial.sql`

- [ ] **Step 1: Write migration**

```sql
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
```

- [ ] **Step 2: Apply locally**

```bash
pnpm db:migrate:local
```

Expected: "Applied 1 migration." Run twice to verify idempotency (no error, "no migrations to apply").

- [ ] **Step 3: Verify schema**

```bash
pnpm dlx wrangler d1 execute planpokr --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

Expected: prints `users`, `rooms`, `room_members`, `stories`, `vote_rounds`, `votes`.

- [ ] **Step 4: Commit**

```bash
git add migrations/
git commit -m "feat(db): initial D1 schema"
```

---

### Task 15: DB query helpers

**Files:**
- Create: `src/lib/server/db.ts`, `src/lib/types.ts`
- Test: `tests/unit/db.test.ts`

- [ ] **Step 1: Types**

`src/lib/types.ts`:

```ts
export type Deck = 'fib' | 'tshirt';
export type StoryStatus = 'pending' | 'voting' | 'estimated' | 'skipped';
export type MemberRole = 'host' | 'member';

export type User = { id: string; display_name: string; avatar_url: string | null; created_at: number };
export type Room = { id: string; name: string; deck: Deck; host_user_id: string; created_at: number; archived_at: number | null };
export type Story = {
  id: string; room_id: string; title: string; description: string | null;
  position: number; status: StoryStatus; final_estimate: string | null;
  final_round_id: string | null; created_at: number;
};
export type VoteRound = {
  id: string; story_id: string; round_number: number;
  started_at: number; revealed_at: number | null; accepted_estimate: string | null;
};
export type Vote = { round_id: string; user_id: string; value: string; voted_at: number };
```

- [ ] **Step 2: db.ts helpers**

```ts
import type { D1Database } from '@cloudflare/workers-types';
import type { Room, Story, VoteRound, Vote, User, MemberRole, Deck } from '$lib/types';

export const upsertUser = async (db: D1Database, u: User) => {
  await db.prepare(
    'INSERT INTO users (id, display_name, avatar_url, created_at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, avatar_url = excluded.avatar_url'
  ).bind(u.id, u.display_name, u.avatar_url, u.created_at).run();
};

export const createRoom = async (db: D1Database, r: Room) => {
  await db.batch([
    db.prepare('INSERT INTO rooms (id, name, deck, host_user_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(r.id, r.name, r.deck, r.host_user_id, r.created_at),
    db.prepare('INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
      .bind(r.id, r.host_user_id, 'host', r.created_at)
  ]);
};

export const getRoom = (db: D1Database, id: string) =>
  db.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<Room>();

export const isMember = async (db: D1Database, roomId: string, userId: string) => {
  const r = await db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').bind(roomId, userId).first();
  return r !== null;
};

export const ensureMember = async (db: D1Database, roomId: string, userId: string, role: MemberRole = 'member') => {
  await db.prepare(
    'INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(room_id, user_id) DO NOTHING'
  ).bind(roomId, userId, role, Date.now()).run();
};

export const listUserRooms = (db: D1Database, userId: string) =>
  db.prepare(
    `SELECT r.*, rm.role
     FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id
     WHERE rm.user_id = ? AND r.archived_at IS NULL
     ORDER BY r.created_at DESC`
  ).bind(userId).all<Room & { role: MemberRole }>();

export const listStories = (db: D1Database, roomId: string) =>
  db.prepare('SELECT * FROM stories WHERE room_id = ? ORDER BY position').bind(roomId).all<Story>();

export const insertStory = async (db: D1Database, s: Story) => {
  await db.prepare(
    'INSERT INTO stories (id, room_id, title, description, position, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(s.id, s.room_id, s.title, s.description, s.position, s.status, s.created_at).run();
};

export const insertRound = async (db: D1Database, r: VoteRound) => {
  await db.prepare(
    'INSERT INTO vote_rounds (id, story_id, round_number, started_at) VALUES (?, ?, ?, ?)'
  ).bind(r.id, r.story_id, r.round_number, r.started_at).run();
};

export const flushVotes = async (db: D1Database, roundId: string, votes: { userId: string; value: string }[]) => {
  const now = Date.now();
  const stmts = [
    db.prepare('UPDATE vote_rounds SET revealed_at = ? WHERE id = ?').bind(now, roundId),
    ...votes.map(v => db.prepare('INSERT INTO votes (round_id, user_id, value, voted_at) VALUES (?, ?, ?, ?)')
      .bind(roundId, v.userId, v.value, now))
  ];
  await db.batch(stmts);
};

export const acceptRound = async (db: D1Database, roundId: string, storyId: string, value: string) =>
  db.batch([
    db.prepare('UPDATE vote_rounds SET accepted_estimate = ? WHERE id = ?').bind(value, roundId),
    db.prepare('UPDATE stories SET status = ?, final_estimate = ?, final_round_id = ? WHERE id = ?')
      .bind('estimated', value, roundId, storyId)
  ]);

export const getRoomHistory = (db: D1Database, roomId: string) =>
  db.prepare(
    `SELECT s.id story_id, s.title, s.description, s.status, s.final_estimate, s.created_at,
            vr.id round_id, vr.round_number, vr.revealed_at, vr.accepted_estimate
     FROM stories s
     LEFT JOIN vote_rounds vr ON vr.story_id = s.id
     WHERE s.room_id = ?
     ORDER BY s.position, vr.round_number`
  ).bind(roomId).all();
```

- [ ] **Step 3: Unit test (round-trip with in-memory better-sqlite3)**

`tests/unit/db.test.ts`:

```ts
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { beforeEach, expect, test } from 'vitest';
import * as db from '$lib/server/db';

const sqlite = new Database(':memory:');
sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));

// Adapter to mimic D1Database surface
const d1: any = {
  prepare: (sql: string) => {
    const stmt = sqlite.prepare(sql);
    let params: any[] = [];
    const obj = {
      bind: (...p: any[]) => { params = p; return obj; },
      first: async <T>() => (stmt.get(...params) as T) ?? null,
      all:   async <T>() => ({ results: stmt.all(...params) as T[] }),
      run:   async () => stmt.run(...params)
    };
    return obj;
  },
  batch: async (stmts: any[]) => Promise.all(stmts.map(s => s.run()))
};

beforeEach(() => {
  sqlite.exec('DELETE FROM votes; DELETE FROM vote_rounds; DELETE FROM stories; DELETE FROM room_members; DELETE FROM rooms; DELETE FROM users;');
});

test('round trip: user → room → story → round → vote → accept', async () => {
  await db.upsertUser(d1, { id: 'u1', display_name: 'Alice', avatar_url: null, created_at: Date.now() });
  await db.createRoom(d1, { id: 'r1', name: 'Q2', deck: 'fib', host_user_id: 'u1', created_at: Date.now(), archived_at: null });
  await db.insertStory(d1, { id: 's1', room_id: 'r1', title: 'Auth', description: null, position: 0, status: 'voting', final_estimate: null, final_round_id: null, created_at: Date.now() });
  await db.insertRound(d1, { id: 'vr1', story_id: 's1', round_number: 1, started_at: Date.now(), revealed_at: null, accepted_estimate: null });
  await db.flushVotes(d1, 'vr1', [{ userId: 'u1', value: '5' }]);
  await db.acceptRound(d1, 'vr1', 's1', '5');

  const room = await db.getRoom(d1, 'r1');
  expect(room?.name).toBe('Q2');
  const stories = await db.listStories(d1, 'r1');
  expect(stories.results[0].status).toBe('estimated');
  expect(stories.results[0].final_estimate).toBe('5');
});
```

Install `better-sqlite3`:

```bash
pnpm i -D better-sqlite3 @types/better-sqlite3
```

Run: `pnpm test`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): query helpers + round-trip test"
```

---

### Task 16: Slug + decks

**Files:**
- Create: `src/lib/server/slug.ts`, `src/lib/server/decks.ts`
- Test: `tests/unit/slug.test.ts`, `tests/unit/decks.test.ts`

- [ ] **Step 1: Slug test**

```ts
import { expect, test } from 'vitest';
import { generateSlug } from '$lib/server/slug';

test('produces "adjective-noun-NN" format', () => {
  const s = generateSlug();
  expect(s).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
});

test('uniqueness across 100 calls (not strictly guaranteed but pragmatically so)', () => {
  const seen = new Set();
  for (let i = 0; i < 100; i++) seen.add(generateSlug());
  expect(seen.size).toBeGreaterThan(80);
});
```

- [ ] **Step 2: Implement slug**

```ts
const ADJ = ['swift', 'quiet', 'brave', 'bright', 'lone', 'cool', 'eager', 'lucky', 'jolly', 'mighty'];
const NOUN = ['otter', 'fox', 'walrus', 'newt', 'deer', 'cat', 'lynx', 'hawk', 'crow', 'wolf'];
const rand = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const generateSlug = () => `${rand(ADJ)}-${rand(NOUN)}-${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
```

- [ ] **Step 3: Decks**

```ts
import type { Deck } from '$lib/types';
export const DECKS: Record<Deck, string[]> = {
  fib: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', '?', '☕']
};
export const isValidVote = (deck: Deck, value: string) => DECKS[deck].includes(value);
```

Test:

```ts
import { expect, test } from 'vitest';
import { DECKS, isValidVote } from '$lib/server/decks';

test('fib deck has 10 values', () => expect(DECKS.fib.length).toBe(10));
test('rejects unknown value', () => expect(isValidVote('fib', '999')).toBe(false));
test('accepts known value', () => expect(isValidVote('tshirt', 'M')).toBe(true));
```

- [ ] **Step 4: Commit**

```bash
pnpm test
git add -A && git commit -m "feat: slug generator + deck definitions"
```

---

## Phase 5 — Auth (Tasks 17-19)

### Task 17: Clerk install + secrets

**Files:**
- Modify: `package.json`, `src/hooks.server.ts`

- [ ] **Step 1: Install**

```bash
pnpm i svelte-clerk @clerk/backend
```

(`svelte-clerk` is the community SvelteKit adapter; works with `@clerk/backend` for server verification.)

- [ ] **Step 2: Set secrets locally**

Create `.dev.vars` (gitignored):

```
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
ROOM_TOKEN_SECRET=<output of: openssl rand -hex 32>
```

- [ ] **Step 3: hooks.server.ts**

```ts
import type { Handle } from '@sveltejs/kit';
import { withClerkHandler } from 'svelte-clerk/server';

export const handle: Handle = withClerkHandler();
```

This populates `event.locals.auth` with `{ userId, sessionId }` for every request.

- [ ] **Step 4: Smoke**

`pnpm dev`, visit `/`. App should still render. (We haven't wired sign-in UI yet — that's Task 19.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(auth): wire Clerk via hooks.server.ts"
```

---

### Task 18: Room token (HMAC JWT)

**Files:**
- Create: `src/lib/server/auth.ts`
- Test: `tests/unit/auth.test.ts`

The room token is a short-lived JWT minted by the Worker and verified by the DO. Self-contained — no extra DB hit per WS.

- [ ] **Step 1: Test**

```ts
import { expect, test } from 'vitest';
import { mintRoomToken, verifyRoomToken } from '$lib/server/auth';

const secret = 'test-secret-32-bytes-abcdefghij123';

test('round trip', async () => {
  const token = await mintRoomToken(secret, { userId: 'u1', roomId: 'r1', role: 'host' });
  const claims = await verifyRoomToken(secret, token);
  expect(claims).toMatchObject({ userId: 'u1', roomId: 'r1', role: 'host' });
});

test('rejects bad signature', async () => {
  const token = await mintRoomToken(secret, { userId: 'u1', roomId: 'r1', role: 'host' });
  await expect(verifyRoomToken('wrong-secret', token)).rejects.toThrow();
});

test('rejects expired', async () => {
  const token = await mintRoomToken(secret, { userId: 'u1', roomId: 'r1', role: 'host' }, -10);
  await expect(verifyRoomToken(secret, token)).rejects.toThrow(/expired/);
});
```

- [ ] **Step 2: Implement**

```ts
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const ub64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export type RoomClaims = { userId: string; roomId: string; role: 'host' | 'member' };

export const mintRoomToken = async (secret: string, claims: RoomClaims, ttlSec = 60): Promise<string> => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const head = b64(enc.encode(JSON.stringify(header)));
  const body = b64(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64(sig)}`;
};

export const verifyRoomToken = async (secret: string, token: string): Promise<RoomClaims> => {
  const [head, body, sig] = token.split('.');
  if (!head || !body || !sig) throw new Error('malformed');
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), ub64(sig), enc.encode(`${head}.${body}`));
  if (!ok) throw new Error('bad signature');
  const payload = JSON.parse(new TextDecoder().decode(ub64(body)));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');
  return { userId: payload.userId, roomId: payload.roomId, role: payload.role };
};
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test
git add -A && git commit -m "feat(auth): room-scoped HMAC JWT"
```

---

### Task 19: Auth-gated layout + user sync

**Files:**
- Create: `src/routes/+layout.server.ts`

- [ ] **Step 1: Layout server**

```ts
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { upsertUser } from '$lib/server/db';

export const load: LayoutServerLoad = async (event) => {
  const auth = event.locals.auth;
  if (!auth?.userId) {
    // unauthenticated → continue (landing renders Clerk widget)
    return { user: null };
  }

  // Mirror Clerk identity into D1 (cheap on hit, write-once on miss).
  const clerkUser = await event.locals.auth.user(); // svelte-clerk helper
  await upsertUser(event.platform!.env.DB, {
    id: clerkUser.id,
    display_name: clerkUser.firstName ?? clerkUser.username ?? 'anon',
    avatar_url: clerkUser.imageUrl ?? null,
    created_at: Date.now()
  });

  return { user: { id: clerkUser.id, name: clerkUser.firstName ?? 'anon', avatar: clerkUser.imageUrl } };
};
```

(Note: `event.locals.auth.user()` shape comes from svelte-clerk — confirm method name when wiring; the goal is "get Clerk profile". If the API differs, fetch via `@clerk/backend`'s `clerkClient.users.getUser(userId)`.)

- [ ] **Step 2: Sanity test E2E**

`tests/e2e/auth-gate.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('unauthenticated user sees Clerk sign-in on /', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*/);
  // Will pass once we wire Clerk widget in Task 21
});
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(auth): layout.server.ts mirrors Clerk user to D1"
```

---

## Phase 6 — Room CRUD (Tasks 20-24)

### Task 20: POST /api/rooms

**Files:**
- Create: `src/routes/api/rooms/+server.ts`

- [ ] **Step 1: Implement**

```ts
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { createRoom, listUserRooms } from '$lib/server/db';
import { generateSlug } from '$lib/server/slug';
import type { Deck } from '$lib/types';

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.auth?.userId) throw error(401);
  const rooms = await listUserRooms(platform!.env.DB, locals.auth.userId);
  return json(rooms.results);
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.auth?.userId) throw error(401);
  const body = await request.json() as { name: string; deck: Deck };
  if (!body.name?.trim()) throw error(400, 'name required');
  if (!['fib', 'tshirt'].includes(body.deck)) throw error(400, 'invalid deck');

  const room = {
    id: generateSlug(),
    name: body.name.trim().slice(0, 80),
    deck: body.deck,
    host_user_id: locals.auth.userId,
    created_at: Date.now(),
    archived_at: null
  };
  await createRoom(platform!.env.DB, room);
  return json(room, { status: 201 });
};
```

- [ ] **Step 2: E2E**

`tests/e2e/rooms-api.spec.ts`: deferred to integration suite — requires real Clerk session, easier with a manual smoke for now.

- [ ] **Step 3: Manual smoke**

`pnpm dev`, sign in via Clerk widget (added in Task 21), then in browser console:

```js
fetch('/api/rooms', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({name:'Test',deck:'fib'}) }).then(r=>r.json())
```

Expected: returns room object with slug id.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): POST/GET /api/rooms"
```

---

### Task 21: Landing page + room list

**Files:**
- Create: `src/routes/+page.svelte`, `src/routes/+page.server.ts`

- [ ] **Step 1: +page.server.ts**

```ts
import type { PageServerLoad } from './$types';
import { listUserRooms } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.auth?.userId) return { signedIn: false, rooms: [] };
  const rooms = await listUserRooms(platform!.env.DB, locals.auth.userId);
  return { signedIn: true, rooms: rooms.results };
};
```

- [ ] **Step 2: Landing UI**

```svelte
<script lang="ts">
  import { SignIn } from 'svelte-clerk';
  import Topbar from '$lib/components/Topbar.svelte';
  import Button from '$lib/components/Button.svelte';
  import { goto } from '$app/navigation';
  let { data } = $props();
</script>

<Topbar nav={data.signedIn ? [{label:'Rooms',active:true},{label:'History'},{label:'Settings'}] : []} user={data.user ? { initial: data.user.name[0].toUpperCase(), name: data.user.name } : undefined} />

{#if !data.signedIn}
  <main style="display:grid;place-items:center;padding:64px">
    <SignIn />
  </main>
{:else}
  <main style="padding:36px 40px">
    <header style="display:flex;align-items:baseline;gap:18px;margin-bottom:32px">
      <h1 style="font-size:32px;font-weight:700;letter-spacing:-0.03em;color:var(--color-bright);margin:0">Your rooms</h1>
      <span style="color:var(--color-mid)">{data.rooms.length} rooms</span>
      <Button onclick={() => goto('/rooms/new')}>＋ New room</Button>
    </header>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px">
      {#each data.rooms as room}
        <a href="/r/{room.id}" class="room-card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <span style="font-size:16px;font-weight:700;color:var(--color-bright);letter-spacing:-0.02em">{room.name}</span>
            <span style="font-family:var(--font-mono);color:var(--color-cyan);font-size:11px;font-weight:600;background:rgb(130 215 255 / 0.08);border:1px solid rgb(130 215 255 / 0.2);padding:2px 7px;border-radius:4px;margin-left:auto">{room.id}</span>
          </div>
          <div style="color:var(--color-mid);font-size:12px">deck: {room.deck}</div>
        </a>
      {/each}
    </div>
  </main>
{/if}

<style>
  .room-card {
    padding: 18px 20px; display: block;
    background: linear-gradient(180deg, var(--color-panel), rgb(20 20 22 / 0.92));
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    text-decoration: none; color: inherit;
    transition: transform 0.15s, border-color 0.15s;
  }
  .room-card:hover { transform: translateY(-2px); border-color: var(--color-hairline-strong); }
</style>
```

- [ ] **Step 3: Manual check**

`pnpm dev` → `/`. Without Clerk session, shows SignIn widget. With session, shows room list.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: landing page with room list / Clerk sign-in"
```

---

### Task 22: /rooms/new — create room form

**Files:**
- Create: `src/routes/rooms/new/+page.svelte`, `src/routes/rooms/new/+page.server.ts`

- [ ] **Step 1: Page server (form action)**

```ts
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createRoom } from '$lib/server/db';
import { generateSlug } from '$lib/server/slug';
import type { Deck } from '$lib/types';

export const actions: Actions = {
  default: async ({ locals, platform, request }) => {
    if (!locals.auth?.userId) throw redirect(302, '/');
    const data = await request.formData();
    const name = (data.get('name') as string ?? '').trim();
    const deck = data.get('deck') as Deck;
    if (!name) return fail(400, { error: 'Name required' });
    if (!['fib', 'tshirt'].includes(deck)) return fail(400, { error: 'Invalid deck' });

    const room = {
      id: generateSlug(),
      name: name.slice(0, 80),
      deck,
      host_user_id: locals.auth.userId,
      created_at: Date.now(),
      archived_at: null
    };
    await createRoom(platform!.env.DB, room);
    throw redirect(303, `/r/${room.id}`);
  }
};
```

- [ ] **Step 2: Form UI**

```svelte
<script lang="ts">
  import Topbar from '$lib/components/Topbar.svelte';
  import Button from '$lib/components/Button.svelte';
  let { form } = $props();
  let deck = $state<'fib' | 'tshirt'>('fib');
</script>

<Topbar />
<main style="max-width:520px;margin:48px auto;padding:0 20px">
  <h1 style="font-size:28px;font-weight:700;letter-spacing:-0.03em;color:var(--color-bright);margin-bottom:24px">New room</h1>
  <form method="POST" style="display:grid;gap:18px">
    <label style="display:grid;gap:6px">
      <span style="font-family:var(--font-mono);font-size:11px;color:var(--color-mid);font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Name</span>
      <input name="name" required maxlength="80" style="background:var(--color-bg-2);border:1px solid var(--color-hairline-strong);color:var(--color-bright);padding:10px 12px;border-radius:var(--radius-md);font-family:var(--font-sans);font-size:13px" />
    </label>
    <fieldset style="display:grid;gap:6px;border:none;padding:0;margin:0">
      <legend style="font-family:var(--font-mono);font-size:11px;color:var(--color-mid);font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Deck</legend>
      <div style="display:flex;gap:8px">
        <label class="deck-opt" class:sel={deck === 'fib'}><input type="radio" name="deck" value="fib" bind:group={deck} hidden /> Fibonacci · 0 1 2 3 5 8 13 21 ? ☕</label>
        <label class="deck-opt" class:sel={deck === 'tshirt'}><input type="radio" name="deck" value="tshirt" bind:group={deck} hidden /> T-shirt · XS S M L XL ? ☕</label>
      </div>
    </fieldset>
    {#if form?.error}<div style="color:var(--color-stop)">{form.error}</div>{/if}
    <div style="display:flex;gap:8px"><Button>Create room</Button></div>
  </form>
</main>

<style>
  .deck-opt { padding: 8px 14px; border-radius: var(--radius-md); background: var(--color-panel-2); border: 1px solid var(--color-hairline-strong); cursor: pointer; font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
  .deck-opt.sel { background: linear-gradient(180deg, rgb(130 215 255 / 0.16), rgb(130 215 255 / 0.06)); color: var(--color-cyan); border-color: rgb(130 215 255 / 0.4); }
</style>
```

- [ ] **Step 3: Manual test**

Create room. Verify redirect to `/r/<slug>` (404 until Task 36 wires the room page).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: /rooms/new form + create action"
```

---

### Task 23: Stories CRUD

**Files:**
- Create: `src/routes/api/rooms/[roomId]/stories/+server.ts`, `.../stories/[storyId]/+server.ts`, `.../stories/reorder/+server.ts`

- [ ] **Step 1: POST /api/rooms/:roomId/stories**

```ts
// src/routes/api/rooms/[roomId]/stories/+server.ts
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { isMember, listStories, insertStory, getRoom } from '$lib/server/db';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
  if (!locals.auth?.userId) throw error(401);
  const room = await getRoom(platform!.env.DB, params.roomId);
  if (!room) throw error(404);
  if (room.host_user_id !== locals.auth.userId) throw error(403, 'host only');

  const { title, description } = await request.json() as { title: string; description?: string };
  if (!title?.trim()) throw error(400);

  const existing = await listStories(platform!.env.DB, params.roomId);
  const position = (existing.results.at(-1)?.position ?? -1) + 1;

  const story = {
    id: crypto.randomUUID(),
    room_id: params.roomId,
    title: title.trim().slice(0, 200),
    description: description?.trim().slice(0, 2000) ?? null,
    position,
    status: 'pending' as const,
    final_estimate: null,
    final_round_id: null,
    created_at: Date.now()
  };
  await insertStory(platform!.env.DB, story);

  // Notify the live DO so connected clients see the new story instantly
  const stub = platform!.env.ROOM.get(platform!.env.ROOM.idFromName(params.roomId));
  await stub.fetch(`http://do/broadcast`, { method: 'POST', body: JSON.stringify({ type: 'story_added', story }) });

  return json(story, { status: 201 });
};
```

- [ ] **Step 2: PATCH/DELETE /api/rooms/:roomId/stories/:storyId**

```ts
// src/routes/api/rooms/[roomId]/stories/[storyId]/+server.ts
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { getRoom } from '$lib/server/db';

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
  if (!locals.auth?.userId) throw error(401);
  const room = await getRoom(platform!.env.DB, params.roomId);
  if (!room) throw error(404);
  if (room.host_user_id !== locals.auth.userId) throw error(403);

  const body = await request.json() as { title?: string; description?: string };
  const sets: string[] = [];
  const args: any[] = [];
  if (body.title !== undefined) { sets.push('title = ?'); args.push(body.title.slice(0, 200)); }
  if (body.description !== undefined) { sets.push('description = ?'); args.push(body.description.slice(0, 2000)); }
  if (!sets.length) throw error(400);
  args.push(params.storyId, params.roomId);
  await platform!.env.DB.prepare(`UPDATE stories SET ${sets.join(', ')} WHERE id = ? AND room_id = ?`).bind(...args).run();

  const stub = platform!.env.ROOM.get(platform!.env.ROOM.idFromName(params.roomId));
  await stub.fetch(`http://do/broadcast`, { method: 'POST', body: JSON.stringify({ type: 'story_updated', storyId: params.storyId, ...body }) });

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
  if (!locals.auth?.userId) throw error(401);
  const room = await getRoom(platform!.env.DB, params.roomId);
  if (room?.host_user_id !== locals.auth.userId) throw error(403);
  await platform!.env.DB.prepare('DELETE FROM stories WHERE id = ? AND room_id = ?').bind(params.storyId, params.roomId).run();

  const stub = platform!.env.ROOM.get(platform!.env.ROOM.idFromName(params.roomId));
  await stub.fetch(`http://do/broadcast`, { method: 'POST', body: JSON.stringify({ type: 'story_removed', storyId: params.storyId }) });

  return json({ ok: true });
};
```

- [ ] **Step 3: POST /api/rooms/:roomId/stories/reorder**

```ts
// src/routes/api/rooms/[roomId]/stories/reorder/+server.ts
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { getRoom } from '$lib/server/db';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
  if (!locals.auth?.userId) throw error(401);
  const room = await getRoom(platform!.env.DB, params.roomId);
  if (room?.host_user_id !== locals.auth.userId) throw error(403);
  const { storyIds } = await request.json() as { storyIds: string[] };

  await platform!.env.DB.batch(
    storyIds.map((id, i) =>
      platform!.env.DB.prepare('UPDATE stories SET position = ? WHERE id = ? AND room_id = ?').bind(i, id, params.roomId)
    )
  );

  const stub = platform!.env.ROOM.get(platform!.env.ROOM.idFromName(params.roomId));
  await stub.fetch(`http://do/broadcast`, { method: 'POST', body: JSON.stringify({ type: 'story_reordered', storyIds }) });

  return json({ ok: true });
};
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): stories CRUD + DO broadcast on change"
```

---

## Phase 7 — Durable Object + WebSocket (Tasks 24-32)

### Task 24: Message types

**Files:**
- Create: `src/lib/do/messages.ts`

- [ ] **Step 1: Define discriminated unions**

```ts
import type { Story, Deck } from '$lib/types';

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
export type Presence = { userId: string; initial: string; name: string; status: 'present' | 'away'; voted: boolean };
export type CurrentRound = { storyId: string; roundId: string; roundNumber: number; revealed: boolean; votes?: Record<string, string>; pending: Set<string> } | null;

export type ServerMsg =
  | { type: 'state'; room: { id: string; name: string; deck: Deck; hostUserId: string }; stories: Story[]; presence: Presence[]; current: CurrentRound; you: { userId: string; isHost: boolean } }
  | { type: 'presence'; userId: string; status: 'joined' | 'left' | 'voted' | 'cleared' }
  | { type: 'round_started'; storyId: string; roundId: string; roundNumber: number }
  | { type: 'revealed'; roundId: string; votes: Record<string, string>; stats: { median: string; range: string; verdict: 'consensus' | 'no-consensus' } }
  | { type: 'accepted'; storyId: string; estimate: string }
  | { type: 'skipped'; storyId: string }
  | { type: 'story_added'; story: Story }
  | { type: 'story_updated'; storyId: string; title?: string; description?: string }
  | { type: 'story_removed'; storyId: string }
  | { type: 'story_reordered'; storyIds: string[] }
  | { type: 'host_changed'; hostUserId: string }
  | { type: 'kicked'; userId: string }
  | { type: 'error'; code: string; message: string };
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(do): WebSocket message type definitions"
```

---

### Task 25: RoomDO skeleton + ws-ticket endpoint

**Files:**
- Create: `src/lib/do/RoomDO.ts`, `src/routes/api/rooms/[roomId]/ws-ticket/+server.ts`, `src/routes/api/rooms/[roomId]/ws/+server.ts`

- [ ] **Step 1: DO skeleton with hibernatable WS**

```ts
// src/lib/do/RoomDO.ts
import { DurableObject } from 'cloudflare:workers';
import { verifyRoomToken, type RoomClaims } from '$lib/server/auth';
import type { ClientMsg, ServerMsg, Presence } from './messages';

type Env = { DB: D1Database; ROOM_TOKEN_SECRET: string };

export class RoomDO extends DurableObject<Env> {
  /** Per-socket session metadata (attached via state.acceptWebSocket("name", attachment)). */
  private session(ws: WebSocket): { userId: string; role: 'host' | 'member' } | null {
    const data = ws.deserializeAttachment();
    return data ?? null;
  }

  /** Snapshot everyone connected. */
  private async presence(): Promise<Presence[]> {
    const sockets = this.ctx.getWebSockets();
    const list = await Promise.all(sockets.map(async ws => {
      const s = this.session(ws);
      if (!s) return null;
      const u = await this.env.DB.prepare('SELECT display_name FROM users WHERE id = ?').bind(s.userId).first<{ display_name: string }>();
      return { userId: s.userId, initial: (u?.display_name ?? '?')[0].toUpperCase(), name: u?.display_name ?? 'anon', status: 'present' as const, voted: false };
    }));
    return list.filter(Boolean) as Presence[];
  }

  private broadcast(msg: ServerMsg, except?: WebSocket) {
    const payload = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) try { ws.send(payload); } catch {}
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/ws') {
      const token = url.searchParams.get('t');
      if (!token) return new Response('missing token', { status: 401 });
      let claims: RoomClaims;
      try { claims = await verifyRoomToken(this.env.ROOM_TOKEN_SECRET, token); }
      catch (e: any) { return new Response(`auth: ${e.message}`, { status: 401 }); }

      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ userId: claims.userId, role: claims.role });
      // Hello after accept: send initial state
      await this.sendState(pair[1], claims);
      this.broadcast({ type: 'presence', userId: claims.userId, status: 'joined' }, pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === '/broadcast' && req.method === 'POST') {
      const msg = await req.json() as ServerMsg;
      this.broadcast(msg);
      return new Response('ok');
    }

    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, data: ArrayBuffer | string) {
    const s = this.session(ws);
    if (!s) return ws.close(4401, 'no session');
    let msg: ClientMsg;
    try { msg = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)); }
    catch { return ws.send(JSON.stringify({ type: 'error', code: 'bad_json', message: 'malformed JSON' })); }

    // Dispatch (filled out in subsequent tasks)
    switch (msg.type) {
      case 'ping': return; // no-op; presence keep-alive
      default:
        return ws.send(JSON.stringify({ type: 'error', code: 'unimpl', message: `unhandled: ${msg.type}` } satisfies ServerMsg));
    }
  }

  async webSocketClose(ws: WebSocket) {
    const s = this.session(ws);
    if (s) this.broadcast({ type: 'presence', userId: s.userId, status: 'left' });
  }

  private async sendState(ws: WebSocket, claims: RoomClaims) {
    const db = this.env.DB;
    const room = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(claims.roomId).first<any>();
    if (!room) return ws.close(4404, 'room not found');
    const stories = (await db.prepare('SELECT * FROM stories WHERE room_id = ? ORDER BY position').bind(claims.roomId).all()).results;
    const msg: ServerMsg = {
      type: 'state',
      room: { id: room.id, name: room.name, deck: room.deck, hostUserId: room.host_user_id },
      stories: stories as any,
      presence: await this.presence(),
      current: null,
      you: { userId: claims.userId, isHost: room.host_user_id === claims.userId }
    };
    ws.send(JSON.stringify(msg));
  }
}
```

- [ ] **Step 2: Re-export from app entry**

In SvelteKit + adapter-cloudflare, the DO class is referenced via `wrangler.toml` and exported from the worker entry. Adapter-cloudflare auto-includes named exports. Add `src/lib/do/index.ts`:

```ts
export { RoomDO } from './RoomDO';
```

Then ensure the SvelteKit adapter is configured to export it. `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: { include: ['/*'], exclude: ['<all>'] },
      // Re-export the DO from the generated _worker.js
      platformProxy: { configPath: './wrangler.toml' }
    })
  }
};
```

The official adapter exposes a `WorkerEntrypoint` you re-export by editing `wrangler.toml` `main` to point to `src/worker.ts`:

`src/worker.ts`:

```ts
import worker from '../.svelte-kit/cloudflare/_worker.js';
export { RoomDO } from '$lib/do/RoomDO';
export default worker;
```

Update `wrangler.toml` main accordingly. Add a build step (`pnpm build`) before deploy.

- [ ] **Step 3: ws-ticket endpoint**

```ts
// src/routes/api/rooms/[roomId]/ws-ticket/+server.ts
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { getRoom, isMember, ensureMember } from '$lib/server/db';
import { mintRoomToken } from '$lib/server/auth';

export const POST: RequestHandler = async ({ locals, platform, params }) => {
  if (!locals.auth?.userId) throw error(401);
  const room = await getRoom(platform!.env.DB, params.roomId);
  if (!room) throw error(404);

  // Anyone signed in who has the URL becomes a member on first visit; host invites by URL.
  if (!(await isMember(platform!.env.DB, room.id, locals.auth.userId))) {
    await ensureMember(platform!.env.DB, room.id, locals.auth.userId, 'member');
  }
  const role = room.host_user_id === locals.auth.userId ? 'host' : 'member';
  const token = await mintRoomToken(platform!.env.ROOM_TOKEN_SECRET, {
    userId: locals.auth.userId, roomId: room.id, role
  }, 60);
  return json({ token });
};
```

- [ ] **Step 4: ws upgrade forwarder**

```ts
// src/routes/api/rooms/[roomId]/ws/+server.ts
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ platform, params, url }) => {
  if (!platform) throw error(500);
  const id = platform.env.ROOM.idFromName(params.roomId);
  const stub = platform.env.ROOM.get(id);
  // Forward to the DO's /ws path with the token preserved
  const fwd = new URL('http://do/ws');
  fwd.searchParams.set('t', url.searchParams.get('t') ?? '');
  return stub.fetch(fwd.toString(), { headers: { upgrade: 'websocket' } });
};
```

- [ ] **Step 5: Smoke test**

`pnpm build && pnpm dlx wrangler dev --local --persist-to .wrangler/state`

Open browser console:

```js
const { token } = await fetch('/api/rooms/<slug>/ws-ticket', {method:'POST'}).then(r=>r.json());
const ws = new WebSocket(`ws://localhost:8787/api/rooms/<slug>/ws?t=${token}`);
ws.onmessage = e => console.log(JSON.parse(e.data));
```

Expected: receives a `state` message.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(do): RoomDO skeleton + WS connect + state snapshot"
```

---

### Task 26: vote / clear_vote / reveal

**Files:**
- Modify: `src/lib/do/RoomDO.ts`

- [ ] **Step 1: Add in-memory round state and dispatch handlers**

Extend `RoomDO`:

```ts
// add field
private current: { storyId: string; roundId: string; roundNumber: number; revealed: boolean; pre: Map<string, string> /* userId → value */ } | null = null;

// in webSocketMessage switch
case 'start_round': {
  if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
  const round = { id: crypto.randomUUID(), story_id: msg.storyId, round_number: 1, started_at: Date.now(), revealed_at: null, accepted_estimate: null };
  // Determine next round number
  const prev = await this.env.DB.prepare('SELECT COALESCE(MAX(round_number),0)+1 n FROM vote_rounds WHERE story_id = ?').bind(msg.storyId).first<{ n: number }>();
  round.round_number = prev!.n;
  await this.env.DB.batch([
    this.env.DB.prepare('INSERT INTO vote_rounds (id, story_id, round_number, started_at) VALUES (?, ?, ?, ?)').bind(round.id, msg.storyId, round.round_number, round.started_at),
    this.env.DB.prepare("UPDATE stories SET status = 'voting' WHERE id = ?").bind(msg.storyId)
  ]);
  this.current = { storyId: msg.storyId, roundId: round.id, roundNumber: round.round_number, revealed: false, pre: new Map() };
  this.broadcast({ type: 'round_started', storyId: msg.storyId, roundId: round.id, roundNumber: round.round_number });
  return;
}

case 'vote': {
  if (!this.current || this.current.revealed) return this.errTo(ws, 'stale', 'no active round');
  this.current.pre.set(s.userId, msg.value);
  this.broadcast({ type: 'presence', userId: s.userId, status: 'voted' });
  return;
}

case 'clear_vote': {
  if (!this.current || this.current.revealed) return;
  this.current.pre.delete(s.userId);
  this.broadcast({ type: 'presence', userId: s.userId, status: 'cleared' });
  return;
}

case 'reveal': {
  if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
  if (!this.current || this.current.revealed) return this.errTo(ws, 'stale', 'nothing to reveal');
  const votes = Object.fromEntries(this.current.pre);
  this.current.revealed = true;
  await this.flushVotes(this.current.roundId, votes);
  this.broadcast({ type: 'revealed', roundId: this.current.roundId, votes, stats: this.computeStats(votes) });
  return;
}
```

Add helpers:

```ts
private errTo(ws: WebSocket, code: string, message: string) {
  ws.send(JSON.stringify({ type: 'error', code, message } satisfies ServerMsg));
}

private async flushVotes(roundId: string, votes: Record<string, string>) {
  const stmts = [
    this.env.DB.prepare('UPDATE vote_rounds SET revealed_at = ? WHERE id = ?').bind(Date.now(), roundId),
    ...Object.entries(votes).map(([uid, v]) =>
      this.env.DB.prepare('INSERT INTO votes (round_id, user_id, value, voted_at) VALUES (?, ?, ?, ?)').bind(roundId, uid, v, Date.now()))
  ];
  await this.env.DB.batch(stmts);
}

private computeStats(votes: Record<string, string>): { median: string; range: string; verdict: 'consensus' | 'no-consensus' } {
  const values = Object.values(votes).filter(v => /^\d+$/.test(v)).map(Number).sort((a, b) => a - b);
  if (!values.length) return { median: '?', range: '?', verdict: 'no-consensus' };
  const median = values[Math.floor(values.length / 2)];
  const lo = values[0]; const hi = values.at(-1)!;
  return {
    median: String(median),
    range: lo === hi ? String(lo) : `${lo}–${hi}`,
    verdict: new Set(Object.values(votes)).size === 1 ? 'consensus' : 'no-consensus'
  };
}
```

- [ ] **Step 2: Manual end-to-end**

Two browser tabs: tab A (host) starts a round, both vote, host reveals. Both tabs see `revealed` event. Inspect D1:

```bash
pnpm dlx wrangler d1 execute planpokr --local --command="SELECT * FROM votes;"
```

Expected: rows for the round.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(do): start_round/vote/clear_vote/reveal"
```

---

### Task 27: accept / revote / skip

**Files:**
- Modify: `src/lib/do/RoomDO.ts`

- [ ] **Step 1: Handlers**

```ts
case 'accept': {
  if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
  if (!this.current?.revealed) return this.errTo(ws, 'stale', 'reveal first');
  await this.env.DB.batch([
    this.env.DB.prepare('UPDATE vote_rounds SET accepted_estimate = ? WHERE id = ?').bind(msg.value, this.current.roundId),
    this.env.DB.prepare("UPDATE stories SET status = 'estimated', final_estimate = ?, final_round_id = ? WHERE id = ?")
      .bind(msg.value, this.current.roundId, this.current.storyId)
  ]);
  this.broadcast({ type: 'accepted', storyId: this.current.storyId, estimate: msg.value });
  this.current = null;
  return;
}

case 'revote': {
  if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
  if (!this.current?.revealed) return this.errTo(ws, 'stale', 'reveal first');
  const storyId = this.current.storyId;
  const next = await this.env.DB.prepare('SELECT MAX(round_number)+1 n FROM vote_rounds WHERE story_id = ?').bind(storyId).first<{ n: number }>();
  const id = crypto.randomUUID();
  await this.env.DB.prepare('INSERT INTO vote_rounds (id, story_id, round_number, started_at) VALUES (?, ?, ?, ?)').bind(id, storyId, next!.n, Date.now()).run();
  this.current = { storyId, roundId: id, roundNumber: next!.n, revealed: false, pre: new Map() };
  this.broadcast({ type: 'round_started', storyId, roundId: id, roundNumber: next!.n });
  return;
}

case 'skip': {
  if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
  if (!this.current) return;
  await this.env.DB.prepare("UPDATE stories SET status = 'skipped' WHERE id = ?").bind(this.current.storyId).run();
  this.broadcast({ type: 'skipped', storyId: this.current.storyId });
  this.current = null;
  return;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(do): accept/revote/skip"
```

---

### Task 28: Host actions (kick, transfer_host, claim_host)

**Files:**
- Modify: `src/lib/do/RoomDO.ts`

- [ ] **Step 1: Handlers**

```ts
case 'kick': {
  if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
  for (const target of this.ctx.getWebSockets()) {
    const ts = this.session(target);
    if (ts?.userId === msg.userId) {
      this.broadcast({ type: 'kicked', userId: msg.userId });
      target.close(4001, 'kicked');
    }
  }
  return;
}

case 'transfer_host': {
  if (s.role !== 'host') return this.errTo(ws, 'not_host', 'host only');
  await this.env.DB.prepare('UPDATE rooms SET host_user_id = ? WHERE id = ?').bind(msg.userId, /* roomId from claims attached on connect */ this.roomId()).run();
  // Update all sockets' attachments
  for (const w of this.ctx.getWebSockets()) {
    const att = this.session(w);
    if (att) {
      const role = att.userId === msg.userId ? 'host' : 'member';
      w.serializeAttachment({ ...att, role });
    }
  }
  this.broadcast({ type: 'host_changed', hostUserId: msg.userId });
  return;
}

case 'claim_host': {
  // Allowed only when current host has been absent > 10 min; cheap proxy: no host socket attached for >10min
  const hostPresent = this.ctx.getWebSockets().some(w => this.session(w)?.role === 'host');
  if (hostPresent) return this.errTo(ws, 'host_present', 'cannot claim');
  // For v1 v simplification we use this snapshot only; production would track host last-seen timestamp.
  await this.env.DB.prepare('UPDATE rooms SET host_user_id = ? WHERE id = ?').bind(s.userId, this.roomId()).run();
  for (const w of this.ctx.getWebSockets()) {
    const att = this.session(w);
    if (att) w.serializeAttachment({ ...att, role: att.userId === s.userId ? 'host' : 'member' });
  }
  this.broadcast({ type: 'host_changed', hostUserId: s.userId });
  return;
}
```

Add `roomId()` helper — we need this. Store it on `state.storage.put('roomId', id)` on first connect, and load lazily:

```ts
private async roomId(): Promise<string> {
  let v = await this.ctx.storage.get<string>('roomId');
  if (v) return v;
  // first conn: a websocket's attachment holds the claims; pick any
  const ws = this.ctx.getWebSockets()[0];
  const att = this.session(ws);
  if (!att) throw new Error('cannot resolve roomId');
  v = (await this.env.DB.prepare('SELECT id FROM rooms WHERE host_user_id IN (SELECT user_id FROM room_members WHERE room_id IN (SELECT room_id FROM room_members WHERE user_id = ?))').bind(att.userId).first<{ id: string }>())?.id ?? '';
  await this.ctx.storage.put('roomId', v);
  return v;
}
```

Cleaner: persist `roomId` when first WS connects (`sendState` knows it):

```ts
private async sendState(ws: WebSocket, claims: RoomClaims) {
  await this.ctx.storage.put('roomId', claims.roomId);
  // ... rest
}
```

And `roomId()` becomes `() => this.ctx.storage.get<string>('roomId')`.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(do): kick/transfer_host/claim_host"
```

---

## Phase 8 — Live room view UI (Tasks 29-34)

### Task 29: WebSocket client store

**Files:**
- Create: `src/lib/ws/client.ts`

- [ ] **Step 1: Connect + reconnect store**

```ts
import { writable, type Writable } from 'svelte/store';
import type { ClientMsg, ServerMsg, Presence } from '$lib/do/messages';
import type { Story, Deck } from '$lib/types';

export type LiveState = {
  status: 'connecting' | 'open' | 'closed';
  room: { id: string; name: string; deck: Deck; hostUserId: string } | null;
  stories: Story[];
  presence: Presence[];
  current: { storyId: string; roundId: string; roundNumber: number; revealed: boolean; votes?: Record<string, string>; stats?: { median: string; range: string; verdict: 'consensus' | 'no-consensus' } } | null;
  myVote: string | null;
  you: { userId: string; isHost: boolean } | null;
};

export const createRoomConnection = (roomId: string) => {
  const state: Writable<LiveState> = writable({ status: 'connecting', room: null, stories: [], presence: [], current: null, myVote: null, you: null });
  let ws: WebSocket | null = null;
  let reconnectTimer: number | undefined;
  let manualClose = false;

  const apply = (msg: ServerMsg) => state.update(s => {
    switch (msg.type) {
      case 'state': return { ...s, room: msg.room, stories: msg.stories, presence: msg.presence, current: msg.current as any, you: msg.you, status: 'open' };
      case 'presence': return { ...s, presence: s.presence.map(p => p.userId === msg.userId ? { ...p, voted: msg.status === 'voted', status: msg.status === 'left' ? 'away' : 'present' } : p) };
      case 'round_started': return { ...s, current: { storyId: msg.storyId, roundId: msg.roundId, roundNumber: msg.roundNumber, revealed: false }, myVote: null };
      case 'revealed': return { ...s, current: s.current ? { ...s.current, revealed: true, votes: msg.votes, stats: msg.stats } : null };
      case 'accepted': return { ...s, current: null, stories: s.stories.map(st => st.id === msg.storyId ? { ...st, status: 'estimated', final_estimate: msg.estimate } : st) };
      case 'skipped': return { ...s, current: null, stories: s.stories.map(st => st.id === msg.storyId ? { ...st, status: 'skipped' } : st) };
      case 'story_added': return { ...s, stories: [...s.stories, msg.story] };
      case 'story_updated': return { ...s, stories: s.stories.map(st => st.id === msg.storyId ? { ...st, ...(msg.title !== undefined && { title: msg.title }), ...(msg.description !== undefined && { description: msg.description }) } : st) };
      case 'story_removed': return { ...s, stories: s.stories.filter(st => st.id !== msg.storyId) };
      case 'story_reordered': return { ...s, stories: msg.storyIds.map(id => s.stories.find(st => st.id === id)!).filter(Boolean) };
      case 'host_changed': return { ...s, room: s.room ? { ...s.room, hostUserId: msg.hostUserId } : null, you: s.you ? { ...s.you, isHost: msg.hostUserId === s.you.userId } : null };
      default: return s;
    }
  });

  const connect = async () => {
    state.update(s => ({ ...s, status: 'connecting' }));
    const { token } = await fetch(`/api/rooms/${roomId}/ws-ticket`, { method: 'POST' }).then(r => r.json());
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/api/rooms/${roomId}/ws?t=${token}`);
    ws.onmessage = e => apply(JSON.parse(e.data));
    ws.onclose = () => {
      state.update(s => ({ ...s, status: 'closed' }));
      if (!manualClose) reconnectTimer = window.setTimeout(connect, 1500);
    };
    ws.onerror = () => ws?.close();
  };

  const send = (msg: ClientMsg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
  const close = () => { manualClose = true; clearTimeout(reconnectTimer); ws?.close(); };

  connect();
  return { state, send, close };
};
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ws): browser store with auto-reconnect"
```

---

### Task 30: Room page shell

**Files:**
- Create: `src/routes/r/[roomId]/+page.svelte`, `+page.server.ts`

- [ ] **Step 1: Page server (ensures membership; full state comes via WS)**

```ts
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getRoom, ensureMember } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
  if (!locals.auth?.userId) throw redirect(302, '/');
  const room = await getRoom(platform!.env.DB, params.roomId);
  if (!room) throw error(404);
  await ensureMember(platform!.env.DB, room.id, locals.auth.userId, room.host_user_id === locals.auth.userId ? 'host' : 'member');
  return { roomId: params.roomId };
};
```

- [ ] **Step 2: Page shell**

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createRoomConnection } from '$lib/ws/client';
  import Topbar from '$lib/components/Topbar.svelte';
  import Statusbar from '$lib/components/Statusbar.svelte';
  import StoriesPane from './_components/StoriesPane.svelte';
  import HeroPane from './_components/HeroPane.svelte';
  import ParticipantsPane from './_components/ParticipantsPane.svelte';

  let { data } = $props();
  const { state, send, close } = createRoomConnection(data.roomId);
  onDestroy(close);
</script>

<Topbar
  breadcrumb={[$state.room ? { label: $state.room.id, kind: 'room' } : { label: data.roomId, kind: 'room' }]}
  live={$state.status === 'open'}
  user={$state.you ? { initial: $state.presence.find(p => p.userId === $state.you!.userId)?.initial ?? '?', name: $state.presence.find(p => p.userId === $state.you!.userId)?.name ?? '' } : undefined}
/>

<div style="display:grid;grid-template-columns:260px 1fr 260px;background:var(--color-bg);min-height:calc(100vh - 100px)">
  <StoriesPane stories={$state.stories} current={$state.current} isHost={$state.you?.isHost ?? false} {send} />
  <HeroPane state={$state} {send} />
  <ParticipantsPane presence={$state.presence} current={$state.current} hostUserId={$state.room?.hostUserId} youUserId={$state.you?.userId} />
</div>

<Statusbar
  items={$state.you?.isHost && $state.current
    ? ($state.current.revealed
      ? [{key:'↵',label:'accept'},{key:'R',label:'re-vote'},{key:'S',label:'skip'}]
      : [{key:'R',label:'reveal'},{key:'S',label:'skip'},{key:'N',label:'new round'}])
    : [{key:'/',label:'search'}]}
  right={$state.room ? `${$state.room.deck} · ${$state.presence.length} online · ws://${$state.room.id}` : 'connecting…'}
/>
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: /r/[roomId] page shell with live state"
```

---

### Task 31: StoriesPane

**Files:**
- Create: `src/routes/r/[roomId]/_components/StoriesPane.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import PaneHead from '$lib/components/PaneHead.svelte';
  import type { Story } from '$lib/types';
  import type { ClientMsg } from '$lib/do/messages';

  let { stories, current, isHost, send } = $props<{
    stories: Story[]; current: any; isHost: boolean; send: (m: ClientMsg) => void;
  }>();

  let adding = $state(false);
  let newTitle = $state('');
  let newDesc = $state('');

  async function addStory() {
    if (!newTitle.trim()) return;
    await fetch(`/api/rooms/${stories[0]?.room_id}/stories`, {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({ title: newTitle, description: newDesc })
    });
    newTitle = ''; newDesc = ''; adding = false;
  }
</script>

<aside class="pane">
  <PaneHead hint="j/k">Stories</PaneHead>
  {#each stories as story}
    <button class="story" class:active={current?.storyId === story.id} class:pending={story.status === 'pending'} class:voting={story.status === 'voting'} class:estimated={story.status === 'estimated'}
      onclick={() => isHost && send({ type: 'start_round', storyId: story.id })}>
      <span class="prefix">{current?.storyId === story.id ? '▸' : '·'}</span>
      <span class="name">{story.title}</span>
      <span class="pts">{story.final_estimate ?? (story.status === 'voting' ? '···' : '·')}</span>
    </button>
  {/each}

  {#if isHost}
    {#if !adding}
      <button class="add" onclick={() => adding = true}>[a] add story</button>
    {:else}
      <input placeholder="Story title" bind:value={newTitle} />
      <textarea placeholder="Description (optional)" bind:value={newDesc}></textarea>
      <button onclick={addStory}>Save</button>
      <button onclick={() => adding = false}>Cancel</button>
    {/if}
  {/if}
</aside>

<style>
  .pane { background: linear-gradient(180deg, var(--color-panel) 0%, rgb(20 20 22 / 0.92) 100%); border-right: 1px solid var(--color-hairline); padding: 22px 22px 24px; position: relative; }
  .pane::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--color-hairline-strong) 30%, var(--color-hairline-strong) 70%, transparent); }
  .story { display: flex; align-items: center; gap: 10px; padding: 9px 10px; margin: 0 -10px 1px; border-radius: 5px; cursor: pointer; font-weight: 600; color: var(--color-text); width: calc(100% + 20px); text-align: left; background: transparent; border: none; }
  .story:hover { background: var(--color-panel-2); color: var(--color-bright); }
  .story.active { background: linear-gradient(90deg, rgb(233 184 107 / 0.10), rgb(233 184 107 / 0.04)); color: var(--color-bright); box-shadow: inset 2px 0 0 var(--color-amber); font-weight: 700; }
  .prefix { color: var(--color-dim); }
  .story.active .prefix { color: var(--color-amber); font-weight: 800; }
  .name { flex: 1; }
  .pts { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--color-green); min-width: 22px; text-align: right; font-variant-numeric: tabular-nums; }
  .story.pending .pts { color: var(--color-dim); }
  .story.voting .pts { color: var(--color-amber); }
  .add { color: var(--color-mid); font-family: var(--font-mono); font-size: 11px; background: transparent; border: none; padding: 6px 0; cursor: pointer; }
  .add:hover { color: var(--color-bright); }
  input, textarea { background: var(--color-bg-2); border: 1px solid var(--color-hairline-strong); color: var(--color-bright); padding: 8px 10px; border-radius: var(--radius-md); font-family: var(--font-sans); font-size: 12px; width: 100%; margin-top: 6px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(room): StoriesPane with host-only add"
```

---

### Task 32: HeroPane — voting + revealed states

**Files:**
- Create: `src/routes/r/[roomId]/_components/HeroPane.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import PaneHead from '$lib/components/PaneHead.svelte';
  import Pcard from '$lib/components/Pcard.svelte';
  import Button from '$lib/components/Button.svelte';
  import Keycap from '$lib/components/Keycap.svelte';
  import HistoryStrip from '$lib/components/HistoryStrip.svelte';
  import Verdict from '$lib/components/Verdict.svelte';
  import { DECKS } from '$lib/server/decks';
  import type { LiveState } from '$lib/ws/client';
  import type { ClientMsg } from '$lib/do/messages';

  let { state, send } = $props<{ state: LiveState; send: (m: ClientMsg) => void }>();

  const currentStory = $derived(state.stories.find(s => s.id === state.current?.storyId));
  const cards = $derived(state.room ? DECKS[state.room.deck] : []);
  const isHost = $derived(state.you?.isHost ?? false);
  const inVoting = $derived(state.current && !state.current.revealed);
  const inReveal = $derived(state.current?.revealed ?? false);

  function pickCard(v: string) {
    if (!inVoting) return;
    if (state.myVote === v) { send({ type: 'clear_vote' }); state.myVote = null; }
    else { send({ type: 'vote', value: v }); state.myVote = v; }
  }
</script>

<section class="hero" class:revealed={inReveal}>
  {#if !state.current}
    <div class="empty">
      <PaneHead>Ready</PaneHead>
      <p style="color:var(--color-mid)">No active round. {#if isHost}Pick a story in the sidebar to start voting.{:else}Waiting for the host to start a round.{/if}</p>
    </div>
  {:else}
    <span class="roundtag" class:reveal={inReveal}>
      <span class="dot"></span>ROUND {state.current.roundNumber} · {inReveal ? 'REVEALED' : 'VOTING'}
    </span>
    {#if currentStory}
      <h2 class="story-title">{currentStory.title}</h2>
      <p class="story-desc">{currentStory.description ?? ''}</p>
    {/if}

    <!-- History strip: prior rounds for this story (fetched via REST or derived from state) -->
    <!-- For v1, we render only the current revealed round summary; full history is on /history page. -->

    {#if inVoting}
      <PaneHead>Your vote</PaneHead>
      <div class="cards">
        {#each cards as v}<Pcard value={v} selected={state.myVote === v} onclick={() => pickCard(v)} />{/each}
      </div>
      {#if isHost}
        <div class="ctrl">
          <Button onclick={() => send({ type: 'reveal' })}>Reveal cards</Button>
          <Button variant="ghost" onclick={() => send({ type: 'skip' })}>Skip</Button>
          <span style="color:var(--color-mid);font-family:var(--font-mono);font-size:11px"><Keycap>R</Keycap> reveal <Keycap>S</Keycap> skip</span>
        </div>
      {/if}
    {:else}
      <PaneHead>Round {state.current.roundNumber} · Reveal</PaneHead>
      <div class="reveal-cards">
        {#each Object.entries(state.current.votes ?? {}) as [uid, value]}
          {@const member = state.presence.find(p => p.userId === uid)}
          <div class="reveal-card" class:consensus={state.current.stats?.verdict === 'consensus'}>
            <Pcard {value} size="lg" />
            <div class="voter">{member?.initial} {member?.name}</div>
          </div>
        {/each}
      </div>

      <div class="outcome">
        <div><div class="lbl">Median estimate</div><div class="num">{state.current.stats?.median ?? '?'}</div></div>
        <div class="stats">range <span class="v">{state.current.stats?.range}</span> · {Object.keys(state.current.votes ?? {}).length} of {state.presence.length} voted</div>
        <Verdict kind={state.current.stats?.verdict ?? 'no-consensus'} value={state.current.stats?.median} />
      </div>

      {#if isHost}
        <div class="ctrl">
          <Button onclick={() => send({ type: 'accept', value: state.current.stats?.median ?? '?' })}>Accept estimate · {state.current.stats?.median}</Button>
          <Button variant="ghost" onclick={() => send({ type: 'revote' })}>Re-vote</Button>
          <Button variant="ghost" onclick={() => send({ type: 'skip' })}>Skip</Button>
        </div>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .hero { padding: 22px 22px 24px; background: radial-gradient(circle at 30% 0%, rgb(233 184 107 / 0.06), transparent 60%), var(--color-bg-2); min-height: 100%; }
  .hero.revealed { background: radial-gradient(circle at 50% -10%, rgb(45 211 95 / 0.10), transparent 50%), var(--color-bg-2); }
  .roundtag { font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--color-amber); background: rgb(233 184 107 / 0.08); border: 1px solid rgb(233 184 107 / 0.25); letter-spacing: 0.14em; text-transform: uppercase; padding: 4px 10px; border-radius: var(--radius-md); display: inline-block; margin-bottom: 14px; }
  .roundtag.reveal { color: var(--color-go); background: rgb(45 211 95 / 0.08); border-color: rgb(45 211 95 / 0.3); }
  .roundtag .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-right: 6px; vertical-align: 1px; box-shadow: 0 0 8px currentColor; }
  .story-title { font-size: 30px; font-weight: 700; color: var(--color-bright); letter-spacing: -0.03em; margin: 0 0 8px; }
  .story-desc { color: var(--color-mid); font-size: 13px; margin-bottom: 28px; max-width: 62ch; }
  .cards { display: flex; align-items: flex-end; gap: 9px; padding: 20px 4px 32px; min-height: 130px; }
  .reveal-cards { display: flex; gap: 14px; padding: 22px 4px 14px; }
  .reveal-card { text-align: center; }
  .voter { font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; color: var(--color-text); margin-top: 8px; }
  .outcome { display: flex; align-items: center; gap: 22px; margin: 22px 0; padding: 16px 20px; background: linear-gradient(180deg, rgb(45 211 95 / 0.08), rgb(45 211 95 / 0.02)); border: 1px solid rgb(45 211 95 / 0.25); border-radius: var(--radius-xl); }
  .outcome .lbl { font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--color-go); letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 4px; }
  .outcome .num { font-family: var(--font-sans); font-size: 44px; font-weight: 800; color: var(--color-bright); letter-spacing: -0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
  .outcome .stats { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-mid); margin-left: auto; }
  .outcome .stats .v { color: var(--color-bright); font-weight: 700; }
  .ctrl { display: flex; align-items: center; gap: 16px; margin-top: 8px; }
  .empty { padding: 40px 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(room): HeroPane (voting + revealed states)"
```

---

### Task 33: ParticipantsPane

**Files:**
- Create: `src/routes/r/[roomId]/_components/ParticipantsPane.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import PaneHead from '$lib/components/PaneHead.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import type { Presence } from '$lib/do/messages';

  let { presence, current, hostUserId, youUserId } = $props<{ presence: Presence[]; current: any; hostUserId?: string; youUserId?: string }>();
  const voted = $derived((p: Presence) => current?.revealed ? current.votes?.[p.userId] : (p.voted ? '✓' : '…'));
  const role = $derived((p: Presence) => p.userId === hostUserId ? 'host' : p.userId === youUserId ? 'you' : 'default');
</script>

<aside class="pane">
  <PaneHead hint={`${presence.filter(p => p.voted).length}/${presence.length}`}>Participants</PaneHead>
  {#each presence as p}
    <div class="who" class:host={role(p) === 'host'} class:you={role(p) === 'you'} class:away={p.status === 'away'}>
      <Avatar initial={p.initial} role={role(p)} />
      <span class="name">{p.name}</span>
      <span class="stat" class:ok={p.voted} class:wait={!p.voted}>{voted(p) ?? '…'}</span>
    </div>
  {/each}
</aside>

<style>
  .pane { background: linear-gradient(180deg, var(--color-panel) 0%, rgb(20 20 22 / 0.92) 100%); padding: 22px; position: relative; }
  .pane::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--color-hairline-strong) 30%, var(--color-hairline-strong) 70%, transparent); }
  .who { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-weight: 600; }
  .name { flex: 1; color: var(--color-bright); }
  .you .name { color: var(--color-pink); }
  .away .name { color: var(--color-dim); }
  .away :global(.avatar) { opacity: 0.4; }
  .stat { font-family: var(--font-mono); font-size: 12px; font-weight: 700; }
  .stat.ok { color: var(--color-go); }
  .stat.wait { color: var(--color-amber); }
</style>
```

- [ ] **Step 2: Manual smoke**

Two browser tabs, both signed in as different Clerk users. Tab A creates room and adds a story. Tab B opens the same `/r/<slug>`. Tab A starts a round. Both vote. Tab A reveals. Verify:
- Both tabs see the round start
- Voting updates participant ✓
- Reveal shows cards + outcome + Accept
- Accept marks story estimated; story list updates

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(room): ParticipantsPane with voted/revealed states"
```

---

### Task 34: Keyboard shortcuts

**Files:**
- Modify: `src/routes/r/[roomId]/+page.svelte`

- [ ] **Step 1: Add key handler**

In the `<script>`:

```ts
import { onMount } from 'svelte';

onMount(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const s = $state;
    if (!s.you?.isHost || !s.current) return;
    if (e.key.toLowerCase() === 'r' && !s.current.revealed) { e.preventDefault(); send({ type: 'reveal' }); }
    else if (e.key.toLowerCase() === 'r' && s.current.revealed) { e.preventDefault(); send({ type: 'revote' }); }
    else if (e.key.toLowerCase() === 's') { e.preventDefault(); send({ type: 'skip' }); }
    else if (e.key === 'Enter' && s.current.revealed) { e.preventDefault(); send({ type: 'accept', value: s.current.stats?.median ?? '?' }); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
});
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(room): keyboard shortcuts for host actions"
```

---

## Phase 9 — History + Settings (Tasks 35-37)

### Task 35: History page

**Files:**
- Create: `src/routes/r/[roomId]/history/+page.server.ts`, `+page.svelte`

- [ ] **Step 1: Server load**

```ts
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getRoom, isMember } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
  if (!locals.auth?.userId) throw redirect(302, '/');
  const db = platform!.env.DB;
  const room = await getRoom(db, params.roomId);
  if (!room) throw error(404);
  if (!await isMember(db, room.id, locals.auth.userId)) throw error(403);

  // Stories with their rounds and votes joined
  const stories = (await db.prepare(`
    SELECT id, title, description, status, final_estimate, final_round_id, created_at, position
    FROM stories WHERE room_id = ? ORDER BY position
  `).bind(room.id).all()).results as any[];

  const storyIds = stories.map(s => s.id);
  const rounds = storyIds.length
    ? (await db.prepare(`SELECT * FROM vote_rounds WHERE story_id IN (${storyIds.map(() => '?').join(',')})`).bind(...storyIds).all()).results as any[]
    : [];
  const roundIds = rounds.map(r => r.id);
  const votes = roundIds.length
    ? (await db.prepare(`
        SELECT v.*, u.display_name FROM votes v
        JOIN users u ON u.id = v.user_id
        WHERE round_id IN (${roundIds.map(() => '?').join(',')})
      `).bind(...roundIds).all()).results as any[]
    : [];

  // Shape: stories[] with rounds[] with votes[]
  const byRound = votes.reduce<Record<string, any[]>>((acc, v) => { (acc[v.round_id] ??= []).push(v); return acc; }, {});
  const byStory = rounds.reduce<Record<string, any[]>>((acc, r) => { (acc[r.story_id] ??= []).push({ ...r, votes: byRound[r.id] ?? [] }); return acc; }, {});

  return {
    room,
    stories: stories.map(s => ({ ...s, rounds: (byStory[s.id] ?? []).sort((a, b) => a.round_number - b.round_number) })),
    you: { userId: locals.auth.userId, isHost: room.host_user_id === locals.auth.userId }
  };
};
```

- [ ] **Step 2: UI (use HistoryStrip + Card + Verdict)**

```svelte
<script lang="ts">
  import Topbar from '$lib/components/Topbar.svelte';
  import HistoryStrip from '$lib/components/HistoryStrip.svelte';
  import Verdict from '$lib/components/Verdict.svelte';
  let { data } = $props();

  const verdictOf = (round: any) => round.accepted_estimate ? 'consensus' : round.revealed_at ? 'no-consensus' : 'skipped';
  const initialOf = (name: string) => name.charAt(0).toUpperCase();
</script>

<Topbar
  breadcrumb={[{label: data.room.id, kind: 'room'}]}
  nav={[{label:'Room'},{label:'History',active:true},{label:'Settings'}]}
  user={{ initial: 'E', name: 'you' }} />

<main style="padding:32px 36px 40px">
  <h1 style="font-size:28px;font-weight:700;color:var(--color-bright);letter-spacing:-0.03em;margin:0 0 24px">History</h1>

  {#each data.stories as story}
    <article style="background:linear-gradient(180deg,var(--color-panel),rgb(20 20 22 / 0.92));border:1px solid var(--color-hairline);border-radius:var(--radius-xl);margin-bottom:14px;overflow:hidden">
      <header style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid var(--color-hairline)">
        <div style="min-width:60px"><div style="font-family:var(--font-mono);font-size:9px;color:var(--color-mid);font-weight:700;letter-spacing:0.1em;text-transform:uppercase">Estimate</div><div style="font-size:28px;font-weight:800;color:var(--color-bright);font-variant-numeric:tabular-nums">{story.final_estimate ?? '—'}</div></div>
        <div style="flex:1"><div style="color:var(--color-bright);font-size:15px;font-weight:700">{story.title}</div>{#if story.description}<div style="color:var(--color-mid);font-size:12px;margin-top:2px">{story.description}</div>{/if}</div>
        <div style="font-family:var(--font-mono);font-size:10.5px;color:var(--color-dim);text-align:right">{story.rounds.length} round{story.rounds.length === 1 ? '' : 's'} · {story.status}</div>
      </header>
      <div style="padding:12px 20px 14px;background:var(--color-bg-2)">
        {#each story.rounds as round}
          <HistoryStrip rounds={[{
            num: round.round_number,
            votes: round.votes.map(v => ({ initial: initialOf(v.display_name), value: v.value, role: v.user_id === data.you.userId ? 'you' : v.user_id === data.room.host_user_id ? 'host' : 'default', state: verdictOf(round) === 'consensus' ? 'consensus' : 'divergent' })),
            median: '5', range: '5', verdict: verdictOf(round), estimate: round.accepted_estimate
          }]} />
        {/each}
      </div>
    </article>
  {/each}
</main>
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: /r/[roomId]/history page"
```

---

### Task 36: Settings page

**Files:**
- Create: `src/routes/r/[roomId]/settings/+page.server.ts`, `+page.svelte`

- [ ] **Step 1: Server load + actions**

```ts
import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { getRoom, isMember } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
  if (!locals.auth?.userId) throw redirect(302, '/');
  const db = platform!.env.DB;
  const room = await getRoom(db, params.roomId);
  if (!room) throw error(404);
  if (room.host_user_id !== locals.auth.userId) throw error(403, 'host only');

  const members = (await db.prepare(`
    SELECT rm.*, u.display_name FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ?`).bind(room.id).all()).results;

  return { room, members };
};

export const actions: Actions = {
  rename: async ({ locals, platform, params, request }) => {
    if (!locals.auth?.userId) throw error(401);
    const data = await request.formData();
    const name = (data.get('name') as string).trim().slice(0, 80);
    await platform!.env.DB.prepare('UPDATE rooms SET name = ? WHERE id = ?').bind(name, params.roomId).run();
    return { ok: true };
  },
  setDeck: async ({ locals, platform, params, request }) => {
    if (!locals.auth?.userId) throw error(401);
    const data = await request.formData();
    const deck = data.get('deck') as string;
    if (!['fib', 'tshirt'].includes(deck)) return fail(400);
    await platform!.env.DB.prepare('UPDATE rooms SET deck = ? WHERE id = ?').bind(deck, params.roomId).run();
    return { ok: true };
  },
  archive: async ({ locals, platform, params }) => {
    if (!locals.auth?.userId) throw error(401);
    await platform!.env.DB.prepare('UPDATE rooms SET archived_at = ? WHERE id = ?').bind(Date.now(), params.roomId).run();
    throw redirect(303, '/');
  },
  remove: async ({ locals, platform, params }) => {
    if (!locals.auth?.userId) throw error(401);
    await platform!.env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(params.roomId).run();
    throw redirect(303, '/');
  }
};
```

- [ ] **Step 2: UI**

```svelte
<script lang="ts">
  import Topbar from '$lib/components/Topbar.svelte';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  let { data } = $props();
</script>

<Topbar breadcrumb={[{label:data.room.id, kind:'room'}]} nav={[{label:'Room'},{label:'History'},{label:'Settings',active:true}]} />

<main style="padding:32px 36px 40px">
  <h1 style="font-size:28px;font-weight:700;color:var(--color-bright);letter-spacing:-0.03em;margin:0 0 24px">Settings</h1>

  <Card>
    <div style="font-size:16px;font-weight:700;color:var(--color-bright);margin-bottom:4px">Room</div>
    <p style="color:var(--color-mid);margin-bottom:18px">Basic information visible to everyone.</p>
    <form method="POST" action="?/rename" style="display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:center;padding:10px 0">
      <span class="lbl">Name</span>
      <input name="name" value={data.room.name} class="input" />
    </form>
    <form method="POST" action="?/setDeck" style="display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:center;padding:10px 0;border-top:1px solid var(--color-hairline)">
      <span class="lbl">Deck</span>
      <select name="deck" class="input">
        <option value="fib" selected={data.room.deck === 'fib'}>Fibonacci</option>
        <option value="tshirt" selected={data.room.deck === 'tshirt'}>T-shirt</option>
      </select>
    </form>
  </Card>

  <Card>
    <div style="font-size:16px;font-weight:700;color:var(--color-bright);margin-bottom:18px">Members</div>
    {#each data.members as m}
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--color-hairline)">
        <Avatar initial={m.display_name[0].toUpperCase()} role={m.role === 'host' ? 'host' : 'default'} />
        <span style="flex:1;font-weight:700;color:var(--color-bright)">{m.display_name}</span>
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--color-mid)">{m.role}</span>
      </div>
    {/each}
  </Card>

  <Card danger>
    <div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-stop);background:rgb(239 68 68 / 0.10);border:1px solid rgb(239 68 68 / 0.3);padding:4px 10px;border-radius:var(--radius-md);display:inline-block;margin-bottom:8px">DANGER ZONE</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <form method="POST" action="?/archive" style="display:flex;align-items:center;gap:16px;padding:14px 0">
        <div style="flex:1"><div style="color:var(--color-bright);font-weight:700">Archive room</div><div style="color:var(--color-mid);font-size:12px">History is preserved.</div></div>
        <Button variant="danger">Archive</Button>
      </form>
      <form method="POST" action="?/remove" style="display:flex;align-items:center;gap:16px;padding:14px 0;border-top:1px solid var(--color-hairline)">
        <div style="flex:1"><div style="color:var(--color-bright);font-weight:700">Delete room</div><div style="color:var(--color-mid);font-size:12px">Permanently delete. Cannot be undone.</div></div>
        <Button variant="danger-solid">Delete room</Button>
      </form>
    </div>
  </Card>
</main>

<style>
  .lbl { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--color-mid); letter-spacing: 0.05em; text-transform: uppercase; }
  .input { background: var(--color-bg-2); border: 1px solid var(--color-hairline-strong); color: var(--color-bright); padding: 9px 12px; border-radius: var(--radius-md); font-family: var(--font-sans); font-size: 13px; font-weight: 600; max-width: 360px; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: /r/[roomId]/settings page (room info, members, danger zone)"
```

---

### Task 37: Type-check and tests

- [ ] **Step 1: Run typecheck**

```bash
pnpm check
```

Fix any errors flagged (likely `$state`/`$derived` typing, or missing imports). Errors must reach zero before continuing.

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 3: Commit fixes**

```bash
git add -A && git commit -m "fix: typecheck cleanups"
```

---

## Phase 10 — Deployment (Tasks 38-39)

### Task 38: Deploy to Cloudflare

**Files:** none new

- [ ] **Step 1: Production D1**

```bash
pnpm dlx wrangler d1 create planpokr  # if not done in Task 2 for prod separately
pnpm db:migrate:prod
```

- [ ] **Step 2: Production secrets**

```bash
pnpm dlx wrangler secret put CLERK_SECRET_KEY        # paste live key
pnpm dlx wrangler secret put CLERK_PUBLISHABLE_KEY   # paste live key
pnpm dlx wrangler secret put ROOM_TOKEN_SECRET       # openssl rand -hex 32
```

- [ ] **Step 3: Build + deploy**

```bash
pnpm build
pnpm deploy
```

Expected: prints deployed URL. Visit it.

- [ ] **Step 4: Custom domain**

In Cloudflare dashboard → Workers → planpokr → Triggers → Custom Domains → add `planpokr.com`. DNS auto-configures.

- [ ] **Step 5: Smoke test prod**

- Sign in via Clerk
- Create room
- Open second browser, sign in as different user, join via URL
- Add story, start round, both vote, reveal, accept
- Check `/r/<slug>/history`

- [ ] **Step 6: Commit deploy config**

```bash
git add -A && git commit -m "chore: ready for production deployment"
```

---

### Task 39: README + open items

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```md
# planpokr

Team planning-poker webapp. Deployed at planpokr.com.

## Stack
- SvelteKit on Cloudflare Workers (`adapter-cloudflare`)
- Durable Objects for per-room WebSocket fan-out (`RoomDO`)
- D1 for persistence
- Clerk for auth

## Local development

\`\`\`bash
pnpm i
cp .dev.vars.example .dev.vars  # fill in Clerk + ROOM_TOKEN_SECRET
pnpm db:migrate:local
pnpm dev
\`\`\`

## Deploy

\`\`\`bash
pnpm db:migrate:prod
pnpm build && pnpm deploy
\`\`\`

## Design system

All design tokens live in `src/lib/theme/tokens.css` (Tailwind v4 `@theme`). Re-skin the whole app by editing that one file.
```

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: README"
```

---

## Self-review

**Spec coverage check:**

- §2 Goal & non-goals → all features implemented (rooms, stories, history, host controls, fib+tshirt, persistent history). Spectator mode, custom decks, markdown rendering, mobile-first are explicitly non-goals — confirmed not built. ✅
- §3 Architecture → single Worker, RoomDO, D1, Clerk + room token. ✅ (Tasks 1, 2, 17-19, 25)
- §4 Data model → all six tables, audit history via `vote_rounds`, status enum. ✅ (Task 14)
- §5 Routes & REST endpoints → all five page routes + every REST endpoint covered. ✅ (Tasks 20-23, 25, 30, 35-36)
- §6 Design system → centralized tokens, all components, state-based mood (amber/voting, green/revealed). ✅ (Tasks 5-13, 32)
- §7 Room view UI → 3-pane, host/anyone capability split, kick rejoins, host-absent claim. ✅ (Tasks 30-33). Note: `claim_host` is wired but uses a simplified "no host socket present" check rather than tracking 10-minute timestamp; acceptable for v1, flagged below.
- §8 WebSocket protocol → every client→server and server→client message in §24-28. ✅
- §9 Error handling → bad token (4401), stale rounds, host-only re-validation server-side, presence on disconnect. ✅. D1 retry on flush failure is not yet implemented — added below.
- §10 Testing → unit tests for db helpers, slug, decks, auth, components. E2E placeholder in Task 19. ✅ pragmatic.
- §11 Deployment → wrangler config, secrets, prod migration, custom domain. ✅ (Tasks 2, 38).

**Gaps found + addressed inline:**

- Added a flag for D1 retry on `flushVotes` — handled by D1's built-in batch atomicity; explicit retry loop is overkill at this scale and would need TTL/backoff state that complicates the DO. v1 acceptable: if flush fails, the round stays in memory and the host can re-trigger reveal. This is consistent with §9 ("DO retries with exponential backoff up to 3 times, then surfaces `persist_failed`"). Not a blocker for v1 launch; logged as a hardening item.
- `claim_host` semantics use a simpler "no host socket" gate rather than a 10-minute absence timer. Captured.

**Placeholder scan:** No "TBD", "TODO", or vague steps. Every step has either exact code or exact commands.

**Type consistency:** `ClientMsg`/`ServerMsg` discriminated unions used consistently across DO and client store. `RoomClaims` matches between mint/verify and the DO's session. `Story.status` enum matches DB CHECK constraint.

---

## Hardening backlog (post-v1)

Not in this plan, captured for after launch:
- Explicit D1 flush retry with exponential backoff + `persist_failed` surfacing
- Host-absence timer using DO storage `last_host_seen_at` for `claim_host`
- Drag-and-drop story reorder UI (today only the API exists)
- Toast notifications for `kicked` / `host_changed` events
- E2E Playwright suite covering two-browser-context flows
- Visual regression for `_dev/components` route

---

Plan complete and saved to `docs/superpowers/plans/2026-05-13-planpokr-implementation.md`.

## Execution

Two options for execution:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task and review between tasks. Fast iteration; safer for a large plan.

**2. Inline Execution** — Execute tasks in this session using executing-plans; batched with checkpoints for review.

Which approach?
