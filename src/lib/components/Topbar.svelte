<script lang="ts">
  import { UserButton } from 'svelte-clerk';
  import { clerkAppearance } from '$lib/clerkAppearance';

  let {
    breadcrumb = [],
    nav = [],
    live = false,
    showUserButton = false,
    showAuthCTAs = false
  } = $props<{
    breadcrumb?: { label: string; kind?: 'room' | 'plain' }[];
    nav?: { label: string; active?: boolean }[];
    live?: boolean;
    showUserButton?: boolean;
    showAuthCTAs?: boolean;
  }>();
</script>

<header class="topbar hairline-top">
  <a href="/" class="brand">planpokr</a>
  {#each breadcrumb as crumb}
    <span class="sep">/</span>
    <span class:room={crumb.kind === 'room'}>{crumb.label}</span>
  {/each}
  {#if nav.length}
    <nav>
      {#each nav as item}<a class:active={item.active}>{item.label}</a>{/each}
    </nav>
  {/if}
  {#if live}<span class="conn">LIVE</span>{/if}
  {#if showAuthCTAs}
    <div class="auth-slot">
      <a class="cta cta-ghost" href="/sign-in">Sign in</a>
      <a class="cta cta-primary" href="/sign-up">Sign up</a>
    </div>
  {/if}
  {#if showUserButton}
    <div class="user-slot">
      <UserButton appearance={clerkAppearance} />
    </div>
  {/if}
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 20px;
    background: linear-gradient(180deg, var(--color-panel-2), var(--color-panel));
    border-bottom: 1px solid var(--color-hairline);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
  }
  .brand {
    color: var(--color-bright);
    font-weight: 800;
    font-size: 14px;
    letter-spacing: -0.025em;
    font-family: var(--font-sans);
    text-decoration: none;
    cursor: pointer;
  }
  .brand:hover { opacity: 0.85; }
  .brand::before {
    content: '';
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 2px;
    background: linear-gradient(135deg, var(--color-cyan), var(--color-mauve));
    margin-right: 8px;
    vertical-align: 1px;
  }
  .sep { color: var(--color-dim); }
  .room { color: var(--color-cyan); font-weight: 600; }
  nav { display: flex; gap: 18px; margin-left: 10px; }
  nav a { color: var(--color-mid); cursor: pointer; }
  nav a.active { color: var(--color-bright); font-weight: 700; }
  .conn {
    margin-left: auto;
    color: var(--color-go);
    display: flex; align-items: center; gap: 8px;
    font-weight: 600; letter-spacing: 0.04em; font-size: 10.5px;
  }
  .conn::before {
    content: '';
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--color-go);
    box-shadow: 0 0 0 2px rgb(45 211 95 / 0.18), 0 0 10px rgb(45 211 95 / 0.5);
  }
  .user-slot { margin-left: auto; display: flex; align-items: center; }
  .conn + .user-slot { margin-left: 14px; }

  .auth-slot {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cta {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: -0.005em;
    padding: 7px 14px;
    border-radius: var(--radius-md);
    text-decoration: none;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .cta-ghost {
    color: var(--color-text);
    background: transparent;
    border: 1px solid transparent;
  }
  .cta-ghost:hover {
    color: var(--color-bright);
    background: var(--color-panel-2);
  }
  .cta-primary {
    color: #082016;
    background: linear-gradient(180deg, var(--color-go-bright), var(--color-go));
    border: 1px solid transparent;
    box-shadow: var(--shadow-go);
  }
  .cta-primary:hover { filter: brightness(1.05); }
</style>
