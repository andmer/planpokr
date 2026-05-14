<script lang="ts">
  import { GoogleOneTap } from 'svelte-clerk';
  import Topbar from '$lib/components/Topbar.svelte';
  import Button from '$lib/components/Button.svelte';
  import PlanningPokerGuide from '$lib/components/PlanningPokerGuide.svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';

  let { data } = $props();

  // Per-card delete dropdown state. Two-step UX: open menu → confirm. The
  // listener closes the menu on any outside click so the host doesn't get a
  // stuck panel after dismissing without an action.
  let openMenuId = $state<string | null>(null);
  let confirmingId = $state<string | null>(null);
  let pendingDeleteId = $state<string | null>(null);

  function toggleMenu(id: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (openMenuId === id) {
      openMenuId = null;
      confirmingId = null;
    } else {
      openMenuId = id;
      confirmingId = null;
    }
  }
  function startConfirm(id: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    confirmingId = id;
  }
  function cancelConfirm(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    confirmingId = null;
    openMenuId = null;
  }
  function onWindowClick(e: MouseEvent) {
    if (!openMenuId) return;
    const target = e.target as HTMLElement | null;
    if (target && !target.closest('.room-menu')) {
      openMenuId = null;
      confirmingId = null;
    }
  }
  $effect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('click', onWindowClick);
    return () => window.removeEventListener('click', onWindowClick);
  });

  // Home nav: signed-in users get a Rooms tab + an About link to the
  // separate /about page (which mounts the same PlanningPokerGuide as the
  // unauth landing). Signed-out users see Sign in / Sign up CTAs instead.
  const nav = $derived(
    data.signedIn
      ? [
          { label: 'Rooms', href: '/', active: true },
          { label: 'About', href: '/about' }
        ]
      : []
  );
</script>

<Topbar {nav} showUserButton={data.signedIn} showAuthCTAs={!data.signedIn} />

{#if !data.signedIn}
  <!-- Show the One Tap prompt on landing so signed-in Google users skip the
       full-page redirect entirely. Falls back to /sign-in if dismissed. -->
  <GoogleOneTap signInForceRedirectUrl="/" signUpForceRedirectUrl="/" />

  <main class="landing">
    <section class="hero hairline-top">
      <h1>planpokr</h1>
      <p class="tagline">Real-time planning poker for your team.</p>
    </section>

    <PlanningPokerGuide />
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
          <div class="room-card-wrap" class:deleting={pendingDeleteId === room.id}>
            <a href="/r/{room.id}" class="room-card">
              <div class="room-row">
                <span class="room-name">{room.name}</span>
                <span class="room-slug">{room.id}</span>
              </div>
              <div class="room-meta">
                <span>deck: {room.deck}</span>
                {#if room.estimated_count > 0}
                  <span class="meta-dot">·</span>
                  <span class="room-points">
                    {Number(room.total_points).toFixed(0)} pts
                  </span>
                  <span class="meta-dot">·</span>
                  <span>{room.estimated_count}/{room.story_count} estimated</span>
                {:else if room.story_count > 0}
                  <span class="meta-dot">·</span>
                  <span>{room.story_count} {room.story_count === 1 ? 'story' : 'stories'}</span>
                {/if}
              </div>
            </a>
            {#if room.role === 'host'}
              <div class="room-menu">
                <button
                  type="button"
                  class="room-menu-trigger"
                  onclick={(e) => toggleMenu(room.id, e)}
                  aria-label="Room actions"
                  aria-haspopup="true"
                  aria-expanded={openMenuId === room.id}
                >
                  <span class="dots">
                    <span></span><span></span><span></span>
                  </span>
                </button>
                {#if openMenuId === room.id}
                  <div class="room-menu-pop" role="menu">
                    {#if confirmingId === room.id}
                      <p class="confirm-text">Delete this room?</p>
                      <p class="confirm-sub">It will disappear from your list. History is preserved on the server.</p>
                      <div class="confirm-actions">
                        <button
                          type="button"
                          class="confirm-cancel"
                          onclick={cancelConfirm}
                        >Cancel</button>
                        <form
                          method="POST"
                          action="?/archiveRoom"
                          use:enhance={() => {
                            pendingDeleteId = room.id;
                            return async ({ update }) => {
                              await update({ reset: true });
                              await invalidateAll();
                              pendingDeleteId = null;
                              openMenuId = null;
                              confirmingId = null;
                            };
                          }}
                        >
                          <input type="hidden" name="roomId" value={room.id} />
                          <button
                            type="submit"
                            class="confirm-delete"
                            disabled={pendingDeleteId === room.id}
                          >
                            {pendingDeleteId === room.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </form>
                      </div>
                    {:else}
                      <button
                        type="button"
                        class="menu-item danger"
                        role="menuitem"
                        onclick={(e) => startConfirm(room.id, e)}
                      >Delete room</button>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </main>
{/if}

<style>
  .landing {
    max-width: 760px;
    margin: 0 auto;
    padding: 56px 24px 96px;
    display: flex;
    flex-direction: column;
    gap: 56px;
  }
  .hero {
    text-align: center;
    padding: 56px 40px;
    background: linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
  }
  .hero h1 {
    font-size: var(--text-display);
    font-weight: 800;
    letter-spacing: -0.035em;
    color: var(--color-bright);
    margin: 0 0 8px;
  }
  .hero .tagline {
    color: var(--color-mid);
    font-size: 13px;
    margin: 0;
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
  .room-card-wrap {
    position: relative;
    transition: opacity 0.2s;
  }
  .room-card-wrap.deleting { opacity: 0.4; pointer-events: none; }
  .room-card {
    /* Right padding leaves room for the absolute-positioned menu trigger
       so the room slug pill doesn't slide under it. */
    padding: 18px 56px 18px 20px;
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
  .room-menu {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
  }
  .room-menu-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    width: 28px;
    height: 28px;
    cursor: pointer;
    padding: 0;
    transition: background 0.12s, border-color 0.12s;
  }
  .room-menu-trigger:hover,
  .room-menu-trigger[aria-expanded='true'] {
    background: var(--color-panel-3);
    border-color: var(--color-hairline-strong);
  }
  .room-menu-trigger .dots {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 18px;
    width: 4px;
  }
  .room-menu-trigger .dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--color-mid);
    transition: background 0.12s;
  }
  .room-menu-trigger:hover .dots span,
  .room-menu-trigger[aria-expanded='true'] .dots span {
    background: var(--color-bright);
  }
  .room-menu-pop {
    position: absolute;
    top: 32px;
    right: 0;
    min-width: 220px;
    background: var(--color-panel-2);
    border: 1px solid var(--color-hairline-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lift);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .menu-item {
    background: none;
    border: none;
    color: var(--color-text);
    text-align: left;
    padding: 8px 10px;
    font-family: var(--font-sans);
    font-size: 12.5px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .menu-item:hover { background: var(--color-panel-3); color: var(--color-bright); }
  .menu-item.danger { color: var(--color-stop); }
  .menu-item.danger:hover { background: rgb(239 68 68 / 0.08); color: #ff6b6b; }
  .confirm-text {
    margin: 6px 8px 4px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-bright);
  }
  .confirm-sub {
    margin: 0 8px 8px;
    font-size: 11.5px;
    color: var(--color-mid);
    line-height: 1.4;
  }
  .confirm-actions {
    display: flex;
    gap: 6px;
    padding: 0 6px 4px;
  }
  .confirm-actions form { flex: 1; display: flex; }
  .confirm-cancel {
    flex: 1;
    background: var(--color-panel-3);
    border: 1px solid var(--color-hairline-strong);
    color: var(--color-text);
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .confirm-cancel:hover { background: var(--color-border); color: var(--color-bright); }
  .confirm-delete {
    flex: 1;
    background: var(--color-stop);
    border: 1px solid var(--color-stop);
    color: #fff;
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: var(--shadow-stop);
  }
  .confirm-delete:hover { filter: brightness(1.1); }
  .confirm-delete:disabled { opacity: 0.6; cursor: not-allowed; }
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
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .room-meta .meta-dot {
    color: var(--color-dim);
  }
  .room-points {
    color: var(--color-go);
    font-weight: 700;
    background: rgb(45 211 95 / 0.08);
    border: 1px solid rgb(45 211 95 / 0.25);
    padding: 1px 7px;
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
  }
</style>
