<script lang="ts">
  import PaneHead from '$lib/components/PaneHead.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import type { Presence } from '$lib/do/messages';
  import type { LiveCurrent } from '$lib/ws/client';

  interface Props {
    presence: Presence[];
    current: LiveCurrent | null;
    hostUserId?: string;
    youUserId?: string;
  }
  let { presence, current, hostUserId, youUserId }: Props = $props();

  function roleFor(p: Presence): 'default' | 'host' | 'you' {
    if (p.userId === hostUserId) return 'host';
    if (p.userId === youUserId) return 'you';
    return 'default';
  }

  function statusFor(p: Presence): { text: string; cls: 'ok' | 'wait' | 'away' | 'reveal' } {
    if (p.status === 'away') return { text: '○', cls: 'away' };
    if (current?.revealed) {
      const v = current.votes?.[p.userId];
      return v ? { text: v, cls: 'reveal' } : { text: '—', cls: 'wait' };
    }
    if (current && !current.revealed) {
      return p.voted ? { text: '✓', cls: 'ok' } : { text: '…', cls: 'wait' };
    }
    return { text: '·', cls: 'wait' };
  }

  const votedCount = $derived(presence.filter((p) => p.voted).length);
</script>

<aside class="pane">
  <PaneHead
    hint={current && !current.revealed
      ? `${votedCount}/${presence.length} voted`
      : `${presence.length} ${presence.length === 1 ? 'person' : 'people'}`}
  >
    Participants
  </PaneHead>

  {#if presence.length === 0}
    <p class="empty">Nobody connected yet.</p>
  {/if}

  {#each presence as p (p.userId)}
    {@const role = roleFor(p)}
    {@const s = statusFor(p)}
    <div
      class="who"
      class:host={role === 'host'}
      class:you={role === 'you'}
      class:away={p.status === 'away'}
    >
      <Avatar initial={p.initial} {role} />
      <span class="name">{p.name}</span>
      {#if role === 'host'}<span class="tag">host</span>{/if}
      <span class="stat {s.cls}">{s.text}</span>
    </div>
  {/each}
</aside>

<style>
  .pane {
    background: linear-gradient(180deg, var(--color-panel) 0%, rgb(20 20 22 / 0.92) 100%);
    padding: 22px;
    position: relative;
    border-left: 1px solid var(--color-hairline);
  }
  .pane::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--color-hairline-strong) 30%,
      var(--color-hairline-strong) 70%,
      transparent
    );
  }
  .empty {
    color: var(--color-dim);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    font-weight: 600;
  }
  .name {
    flex: 1;
    color: var(--color-bright);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .you .name {
    color: var(--color-pink);
  }
  .away .name {
    color: var(--color-dim);
  }
  .away :global(.avatar) {
    opacity: 0.4;
  }
  .tag {
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 800;
    color: var(--color-mauve);
    background: rgb(196 167 250 / 0.08);
    border: 1px solid rgb(196 167 250 / 0.25);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .stat {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    min-width: 24px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .stat.ok {
    color: var(--color-go);
  }
  .stat.wait {
    color: var(--color-amber);
  }
  .stat.away {
    color: var(--color-dim);
  }
  .stat.reveal {
    color: var(--color-bright);
  }
</style>
