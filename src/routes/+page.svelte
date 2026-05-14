<script lang="ts">
  import { SignIn } from 'svelte-clerk';
  import Topbar from '$lib/components/Topbar.svelte';
  import Button from '$lib/components/Button.svelte';
  import { goto } from '$app/navigation';

  let { data } = $props();

  // Guard: layout data.user may be null when signed out. Even when signed in,
  // `name` is a string we control, but the optional chaining keeps the topbar
  // resilient to unexpected null/empty values during hydration.
  const user = $derived(
    data.user && data.user.name
      ? { initial: data.user.name.charAt(0).toUpperCase() || '?', name: data.user.name }
      : undefined
  );

  const nav = $derived(
    data.signedIn
      ? [{ label: 'Rooms', active: true }, { label: 'History' }, { label: 'Settings' }]
      : []
  );
</script>

<Topbar {nav} {user} />

{#if !data.signedIn}
  <main class="signin-wrap">
    <SignIn />
  </main>
{:else}
  <main class="rooms-wrap">
    <header class="rooms-head">
      <h1>Your rooms</h1>
      <span class="count">{data.rooms.length} rooms</span>
      <Button onclick={() => goto('/rooms/new')}>＋ New room</Button>
    </header>

    {#if data.rooms.length === 0}
      <p class="empty">No rooms yet. Create one to get started.</p>
    {:else}
      <div class="room-grid">
        {#each data.rooms as room (room.id)}
          <a href="/r/{room.id}" class="room-card">
            <div class="room-row">
              <span class="room-name">{room.name}</span>
              <span class="room-slug">{room.id}</span>
            </div>
            <div class="room-meta">deck: {room.deck}</div>
          </a>
        {/each}
      </div>
    {/if}
  </main>
{/if}

<style>
  .signin-wrap {
    display: grid;
    place-items: center;
    padding: 64px 20px;
  }
  .rooms-wrap {
    padding: 36px 40px;
  }
  .rooms-head {
    display: flex;
    align-items: baseline;
    gap: 18px;
    margin-bottom: 32px;
  }
  .rooms-head h1 {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-bright);
    margin: 0;
  }
  .count {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .empty {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .room-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .room-card {
    padding: 18px 20px;
    display: block;
    background: linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    text-decoration: none;
    color: inherit;
    transition:
      transform 0.15s,
      border-color 0.15s;
  }
  .room-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-hairline-strong);
  }
  .room-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .room-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-bright);
    letter-spacing: -0.02em;
  }
  .room-slug {
    font-family: var(--font-mono);
    color: var(--color-cyan);
    font-size: 11px;
    font-weight: 600;
    background: rgb(130 215 255 / 0.08);
    border: 1px solid rgb(130 215 255 / 0.2);
    padding: 2px 7px;
    border-radius: var(--radius-sm);
    margin-left: auto;
  }
  .room-meta {
    color: var(--color-mid);
    font-size: 12px;
    font-family: var(--font-mono);
  }
</style>
