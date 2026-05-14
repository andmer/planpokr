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

  // We keep the writable store and read it in templates via `$state.*` (the
  // Svelte store auto-subscribe syntax). `send` is a plain function; `close`
  // is wired to onDestroy. The keyboard handler reads the store via `get()`
  // (not the `$` prefix, which is parser-magical only inside templates).
  // `data.roomId` is reactive (from `$props()`), but the WebSocket
  // connection is bound to the room for the lifetime of this page mount.
  // SvelteKit re-mounts the page on roomId param change, so capturing the
  // initial value via `untrack` is correct here.
  const conn = createRoomConnection(untrack(() => data.roomId));
  const { state, send, setMyVote, close } = conn;

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
      const s = get(state);
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
  breadcrumb={[{ label: $state.room?.id ?? data.roomId, kind: 'room' }]}
  live={$state.status === 'open'}
  user={(() => {
    const me = $state.you ? $state.presence.find((p) => p.userId === $state.you!.userId) : undefined;
    return me ? { initial: me.initial, name: me.name } : undefined;
  })()}
/>

<div class="room-grid">
  <StoriesPane
    roomId={data.roomId}
    stories={$state.stories}
    current={$state.current}
    isHost={$state.you?.isHost ?? false}
    {send}
  />
  <HeroPane state={$state} {send} {setMyVote} />
  <ParticipantsPane
    presence={$state.presence}
    current={$state.current}
    hostUserId={$state.room?.hostUserId}
    youUserId={$state.you?.userId}
  />
</div>

<Statusbar
  items={$state.you?.isHost && $state.current
    ? $state.current.revealed
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
  right={$state.room
    ? `${$state.room.deck} · ${$state.presence.length} online · ${$state.status}`
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
