<script lang="ts">
  import PaneHead from '$lib/components/PaneHead.svelte';
  import Pcard from '$lib/components/Pcard.svelte';
  import Button from '$lib/components/Button.svelte';
  import Keycap from '$lib/components/Keycap.svelte';
  import Verdict from '$lib/components/Verdict.svelte';
  import HistoryStrip from '$lib/components/HistoryStrip.svelte';
  import { DECKS } from '$lib/decks';
  import type { LiveState } from '$lib/ws/client';
  import type { ClientMsg } from '$lib/do/messages';
  import type { Deck } from '$lib/types';

  interface Props {
    state: LiveState;
    send: (m: ClientMsg) => void;
    setMyVote: (v: string | null) => void;
  }
  let { state, send, setMyVote }: Props = $props();

  const currentStory = $derived(state.stories.find((s) => s.id === state.current?.storyId));
  const cards = $derived<string[]>(state.room ? DECKS[state.room.deck as Deck] : []);
  const isHost = $derived(state.you?.isHost ?? false);
  const inVoting = $derived(!!state.current && !state.current.revealed);
  const inReveal = $derived(state.current?.revealed ?? false);

  // Map server-sent priorRounds onto the shape HistoryStrip expects.
  // `role` colours the chip per voter (you/host/default); `state` ties the
  // chip border to the round's verdict so divergent rounds read as red.
  const priorRoundsForStrip = $derived(
    (state.current?.priorRounds ?? []).map((pr) => ({
      num: pr.roundNumber,
      votes: pr.votes.map((v) => ({
        initial: v.initial,
        value: v.value,
        role:
          v.userId === state.you?.userId
            ? ('you' as const)
            : v.userId === state.room?.hostUserId
              ? ('host' as const)
              : ('default' as const),
        state:
          pr.stats.verdict === 'consensus'
            ? ('consensus' as const)
            : ('divergent' as const)
      })),
      median: pr.stats.median,
      range: pr.stats.range,
      verdict: pr.stats.verdict,
      estimate: pr.acceptedEstimate ?? undefined
    }))
  );

  function pickCard(v: string) {
    if (!inVoting) return;
    if (state.myVote === v) {
      send({ type: 'clear_vote' });
      setMyVote(null);
    } else {
      send({ type: 'vote', value: v });
      setMyVote(v);
    }
  }
</script>

<section class="hero" class:revealed={inReveal}>
  {#if !state.current}
    <div class="empty">
      <PaneHead>Ready</PaneHead>
      <p class="empty-msg">
        No active round.
        {#if isHost}
          Pick a story in the sidebar to start voting.
        {:else}
          Waiting for the host to start a round.
        {/if}
      </p>
    </div>
  {:else}
    <span class="roundtag" class:reveal={inReveal}>
      <span class="dot"></span>ROUND {state.current.roundNumber} · {inReveal ? 'REVEALED' : 'VOTING'}
    </span>
    {#if currentStory}
      <h2 class="story-title">{currentStory.title}</h2>
      {#if currentStory.description}
        <p class="story-desc">{currentStory.description}</p>
      {/if}
    {/if}

    {#if inVoting}
      <PaneHead>Your vote</PaneHead>
      <div class="cards">
        {#each cards as v (v)}
          <Pcard value={v} selected={state.myVote === v} onclick={() => pickCard(v)} />
        {/each}
      </div>
      {#if isHost}
        <div class="ctrl">
          <Button onclick={() => send({ type: 'reveal' })}>Reveal cards</Button>
          <Button variant="ghost" onclick={() => send({ type: 'skip' })}>Skip</Button>
          <span class="hint">
            <Keycap>R</Keycap>
            reveal <Keycap>S</Keycap> skip
          </span>
        </div>
      {/if}
    {:else if state.current.revealed}
      <PaneHead>Round {state.current.roundNumber} · Reveal</PaneHead>
      <div class="reveal-cards">
        {#each Object.entries(state.current.votes ?? {}) as [uid, value] (uid)}
          {@const member = state.presence.find((p) => p.userId === uid)}
          <div class="reveal-card" class:consensus={state.current?.stats?.verdict === 'consensus'}>
            <Pcard value={String(value)} size="lg" />
            <div class="voter">{member?.initial ?? '?'} {member?.name ?? ''}</div>
          </div>
        {/each}
        {#if Object.keys(state.current.votes ?? {}).length === 0}
          <p class="empty-msg">No votes were cast this round.</p>
        {/if}
      </div>

      <div class="outcome">
        <div>
          <div class="lbl">Median estimate</div>
          <div class="num">{state.current.stats?.median ?? '?'}</div>
        </div>
        <div class="stats">
          range <span class="v">{state.current.stats?.range ?? '?'}</span>
          · {Object.keys(state.current.votes ?? {}).length} of {state.presence.length} voted
        </div>
        <Verdict
          kind={state.current.stats?.verdict ?? 'no-consensus'}
          value={state.current.stats?.median}
        />
      </div>

      {#if isHost}
        <div class="ctrl">
          <Button
            onclick={() => send({ type: 'accept', value: state.current?.stats?.median ?? '?' })}
          >
            Accept estimate · {state.current.stats?.median ?? '?'}
          </Button>
          <Button variant="ghost" onclick={() => send({ type: 'revote' })}>Re-vote</Button>
          <Button variant="ghost" onclick={() => send({ type: 'skip' })}>Skip</Button>
          <span class="hint">
            <Keycap>↵</Keycap>
            accept <Keycap>R</Keycap> revote <Keycap>S</Keycap> skip
          </span>
        </div>
      {/if}
    {/if}

    {#if priorRoundsForStrip.length}
      <div class="prior">
        <PaneHead>Previous rounds</PaneHead>
        <HistoryStrip rounds={priorRoundsForStrip} />
      </div>
    {/if}
  {/if}
</section>

<style>
  .hero {
    padding: 22px 22px 24px;
    background:
      radial-gradient(circle at 30% 0%, rgb(233 184 107 / 0.06), transparent 60%),
      var(--color-bg-2);
    min-height: 100%;
  }
  .hero.revealed {
    background:
      radial-gradient(circle at 50% -10%, rgb(45 211 95 / 0.1), transparent 50%),
      var(--color-bg-2);
  }
  .roundtag {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 800;
    color: var(--color-amber);
    background: rgb(233 184 107 / 0.08);
    border: 1px solid rgb(233 184 107 / 0.25);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: var(--radius-md);
    display: inline-block;
    margin-bottom: 14px;
  }
  .roundtag.reveal {
    color: var(--color-go);
    background: rgb(45 211 95 / 0.08);
    border-color: rgb(45 211 95 / 0.3);
  }
  .roundtag .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    margin-right: 6px;
    vertical-align: 1px;
    box-shadow: 0 0 8px currentColor;
  }
  .story-title {
    font-size: 30px;
    font-weight: 700;
    color: var(--color-bright);
    letter-spacing: -0.03em;
    margin: 0 0 8px;
  }
  .story-desc {
    color: var(--color-mid);
    font-size: 13px;
    margin: 0 0 28px;
    max-width: 62ch;
  }
  .cards {
    display: flex;
    align-items: flex-end;
    gap: 9px;
    padding: 20px 4px 32px;
    min-height: 130px;
    flex-wrap: wrap;
  }
  .reveal-cards {
    display: flex;
    gap: 14px;
    padding: 22px 4px 14px;
    flex-wrap: wrap;
  }
  .reveal-card {
    text-align: center;
  }
  .voter {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    color: var(--color-text);
    margin-top: 8px;
  }
  .outcome {
    display: flex;
    align-items: center;
    gap: 22px;
    margin: 22px 0;
    padding: 16px 20px;
    background: linear-gradient(180deg, rgb(45 211 95 / 0.08), rgb(45 211 95 / 0.02));
    border: 1px solid rgb(45 211 95 / 0.25);
    border-radius: var(--radius-xl);
  }
  .outcome .lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 800;
    color: var(--color-go);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .outcome .num {
    font-family: var(--font-sans);
    font-size: 44px;
    font-weight: 800;
    color: var(--color-bright);
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .outcome .stats {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--color-mid);
    margin-left: auto;
  }
  .outcome .stats .v {
    color: var(--color-bright);
    font-weight: 700;
  }
  .ctrl {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .prior {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .hint {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .empty {
    padding: 40px 0;
  }
  .empty-msg {
    color: var(--color-mid);
    font-size: 13px;
    margin: 0;
  }
</style>
