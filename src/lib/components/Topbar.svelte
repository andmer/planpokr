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
