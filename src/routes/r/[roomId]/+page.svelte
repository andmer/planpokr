<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { createRoomConnection } from '$lib/ws/client';
  import Topbar from '$lib/components/Topbar.svelte';
  import Statusbar from '$lib/components/Statusbar.svelte';
  import StoriesPane from './_components/StoriesPane.svelte';
  import HeroPane from './_components/HeroPane.svelte';
  import ParticipantsPane from './_components/ParticipantsPane.svelte';

  let { data } = $props();

  // The store is destructured as `live` (not `state`) because Svelte 5's
  // runes mode reserves `$state` as a rune name — using a store called
  // `state` would make `$state.foo` ambiguous and breaks SSR with
  // "store.subscribe is not a function". `$live` is the auto-subscribe.
  // `send` is a plain function; `close` is wired to onDestroy. The keyboard
  // handler reads the store via `get()` (the `$` prefix is template-only).
  // `data.roomId` is reactive (from `$props()`), but the WebSocket
  // connection is bound to the room for the lifetime of this page mount.
  // SvelteKit re-mounts the page on roomId param change, so capturing the
  // initial value via `untrack` is correct here.
  const conn = createRoomConnection(untrack(() => data.roomId));
  const { state: live, send, setMyVote, close } = conn;

  onDestroy(close);

  // Task 34 — global keyboard shortcuts for host actions.
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      const s = get(live);
      if (!s.you?.isHost || !s.current) return;
      const k = e.key.toLowerCase();
      if (k === 'r' && !s.current.revealed) {
        e.preventDefault();
        send({ type: 'reveal' });
      } else if (k === 'r' && s.current.revealed) {
        e.preventDefault();
        send({ type: 'revote' });
      } else if (k === 's') {
        e.preventDefault();
        send({ type: 'skip' });
      } else if (e.key === 'Enter' && s.current.revealed) {
        e.preventDefault();
        send({ type: 'accept', value: s.current.stats?.median ?? '?' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<Topbar
  breadcrumb={[{ label: $live.room?.id ?? data.roomId, kind: 'room' }]}
  live={$live.status === 'open'}
  showUserButton
/>

<div class="room-grid">
  <StoriesPane
    roomId={data.roomId}
    stories={$live.stories}
    current={$live.current}
    isHost={$live.you?.isHost ?? false}
    {send}
  />
  <HeroPane state={$live} {send} {setMyVote} />
  <ParticipantsPane
    presence={$live.presence}
    current={$live.current}
    hostUserId={$live.room?.hostUserId}
    youUserId={$live.you?.userId}
  />
</div>

<Statusbar
  items={$live.you?.isHost && $live.current
    ? $live.current.revealed
      ? [
          { key: '↵', label: 'accept' },
          { key: 'R', label: 're-vote' },
          { key: 'S', label: 'skip' }
        ]
      : [
          { key: 'R', label: 'reveal' },
          { key: 'S', label: 'skip' }
        ]
    : [{ key: '/', label: 'search' }]}
  right={$live.room
    ? `${$live.room.deck} · ${$live.presence.length} online · ${$live.status}`
    : 'connecting…'}
/>

<style>
  .room-grid {
    display: grid;
    grid-template-columns: 260px 1fr 260px;
    background: var(--color-bg);
    min-height: calc(100vh - 100px);
  }
</style>
