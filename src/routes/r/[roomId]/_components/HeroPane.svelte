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
    live: LiveState;
    send: (m: ClientMsg) => void;
    setMyVote: (v: string | null) => void;
  }
  let { live, send, setMyVote }: Props = $props();

  const currentStory = $derived(live.stories.find((s) => s.id === live.current?.storyId));
  const cards = $derived<string[]>(live.room ? DECKS[live.room.deck as Deck] : []);
  const isHost = $derived(live.you?.isHost ?? false);
  const inVoting = $derived(!!live.current && !live.current.revealed);
  const inReveal = $derived(live.current?.revealed ?? false);
  const consensusReached = $derived(
    inReveal && live.current?.stats?.verdict === 'consensus'
  );

  // Auto-accept on consensus: when the host reaches consensus on a reveal,
  // run a 5s countdown then fire `accept` automatically. Re-vote / Skip
  // (or anything that takes consensusReached false) cancels the timer.
  // Keeps host attention on the room without requiring an extra click for
  // the common case, while leaving an escape hatch for the rare misvote.
  const AUTO_ACCEPT_SECONDS = 5;
  let countdown = $state<number | null>(null);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  function cancelCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    countdown = null;
  }
  function startCountdown() {
    cancelCountdown();
    countdown = AUTO_ACCEPT_SECONDS;
    countdownTimer = setInterval(() => {
      countdown = (countdown ?? 0) - 1;
      if ((countdown ?? 0) <= 0) {
        cancelCountdown();
        send({ type: 'accept', value: live.current?.stats?.median ?? '?' });
      }
    }, 1000);
  }
  $effect(() => {
    if (consensusReached && isHost) {
      // Use roundId as an effect dependency so a re-vote landing on
      // consensus again restarts the countdown for the new round.
      void live.current?.roundId;
      startCountdown();
    } else {
      cancelCountdown();
    }
    return cancelCountdown;
  });
  // After Accept / Skip, `live.current` clears but `lastFinalized` carries
  // the just-locked-in result so we can show it in the middle until the
  // host moves on to another story.
  const finalized = $derived(
    !live.current && live.lastFinalized
      ? {
          ...live.lastFinalized,
          story: live.stories.find((st) => st.id === live.lastFinalized!.storyId)
        }
      : null
  );

  // Map server-sent priorRounds onto the shape HistoryStrip expects.
  // `role` colours the chip per voter (you/host/default); `state` ties the
  // chip border to the round's verdict so divergent rounds read as red.
  const priorRoundsForStrip = $derived(
    (live.current?.priorRounds ?? []).map((pr) => ({
      num: pr.roundNumber,
      votes: pr.votes.map((v) => ({
        initial: v.initial,
        value: v.value,
        role:
          v.userId === live.you?.userId
            ? ('you' as const)
            : v.userId === live.room?.hostUserId
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
    if (live.myVote === v) {
      send({ type: 'clear_vote' });
      setMyVote(null);
    } else {
      send({ type: 'vote', value: v });
      setMyVote(v);
    }
  }
</script>

<section
  class="hero"
  class:revealed={inReveal}
  class:finalized={!!finalized}
>
  {#if !live.current && finalized}
    <!-- Show the just-locked-in story as the primary content of the hero
         pane. Cleared on the next round_started, so picking another story
         in the sidebar transitions naturally back into voting. -->
    <div class="final-pane" class:skipped={finalized.kind === 'skipped'}>
      <div class="final-tag">
        {#if finalized.kind === 'accepted'}
          <span class="check">✓</span> ESTIMATED
        {:else}
          <span class="check">↷</span> SKIPPED
        {/if}
      </div>
      {#if finalized.story}
        <h2 class="final-story">{finalized.story.title}</h2>
        {#if finalized.story.description}
          <p class="final-desc">{finalized.story.description}</p>
        {/if}
      {/if}
      {#if finalized.kind === 'accepted'}
        <div class="final-num">{finalized.estimate}</div>
      {:else}
        <!-- Skipped stories have no meaningful estimate. Rendering the
             em-dash at 120px looked like a giant white bar; instead show
             a small muted "No estimate" label so the layout breathes. -->
        <div class="final-skipped-note">No estimate</div>
      {/if}
      {#if isHost}
        <div class="final-actions">
          <Button
            variant="ghost"
            onclick={() => send({ type: 'start_round', storyId: finalized.storyId })}
          >
            Re-open voting
          </Button>
        </div>
        <p class="final-hint">Or pick the next story in the sidebar to continue.</p>
      {:else}
        <p class="final-hint">Waiting for the host to start the next round.</p>
      {/if}
    </div>
  {:else if !live.current}
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
      <span class="dot"></span>ROUND {live.current.roundNumber} · {inReveal ? 'REVEALED' : 'VOTING'}
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
          <Pcard value={v} selected={live.myVote === v} onclick={() => pickCard(v)} />
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
    {:else if live.current.revealed && consensusReached}
      <!-- Consensus path: simplified celebratory display. Per-voter chips and
           median/range row hidden — everyone voted the same, so there's
           nothing extra to read. Big number + primary Accept + secondary
           re-vote/skip for the edge case where the host wants to overturn. -->
      <div class="consensus-pane">
        <div class="consensus-tag">
          <span class="check">✓</span> CONSENSUS REACHED
        </div>
        <div class="consensus-num">{live.current.stats?.median ?? '?'}</div>
        <div class="consensus-meta">
          {Object.keys(live.current.votes ?? {}).length} of {live.presence.length} agreed
        </div>
        {#if isHost}
          <div class="consensus-ctrl">
            <Button
              onclick={() => {
                cancelCountdown();
                send({ type: 'accept', value: live.current?.stats?.median ?? '?' });
              }}
            >
              Accept estimate · {live.current.stats?.median ?? '?'}
            </Button>
            {#if countdown !== null}
              <div class="countdown" aria-live="polite">
                Auto-accepting in <strong>{countdown}s</strong>
                · <button
                  type="button"
                  class="link"
                  onclick={cancelCountdown}
                >Cancel</button>
              </div>
            {/if}
            <div class="secondary">
              <button
                class="link"
                onclick={() => {
                  cancelCountdown();
                  send({ type: 'revote' });
                }}
              >Re-vote</button>
              <span class="dot">·</span>
              <button
                class="link"
                onclick={() => {
                  cancelCountdown();
                  send({ type: 'skip' });
                }}
              >Skip</button>
              <span class="hint">
                <Keycap>↵</Keycap> accept <Keycap>R</Keycap> revote <Keycap>S</Keycap> skip
              </span>
            </div>
          </div>
        {/if}
      </div>
    {:else if live.current.revealed}
      <PaneHead>Round {live.current.roundNumber} · Reveal</PaneHead>
      <div class="reveal-cards">
        {#each Object.entries(live.current.votes ?? {}) as [uid, value] (uid)}
          {@const member = live.presence.find((p) => p.userId === uid)}
          <div class="reveal-card">
            <Pcard value={String(value)} size="lg" />
            <div class="voter">{member?.initial ?? '?'} {member?.name ?? ''}</div>
          </div>
        {/each}
        {#if Object.keys(live.current.votes ?? {}).length === 0}
          <p class="empty-msg">No votes were cast this round.</p>
        {/if}
      </div>

      <div class="outcome">
        <div>
          <div class="lbl">Median estimate</div>
          <div class="num">{live.current.stats?.median ?? '?'}</div>
        </div>
        <div class="stats">
          range <span class="v">{live.current.stats?.range ?? '?'}</span>
          · {Object.keys(live.current.votes ?? {}).length} of {live.presence.length} voted
        </div>
        <Verdict
          kind={live.current.stats?.verdict ?? 'no-consensus'}
          value={live.current.stats?.median}
        />
      </div>

      {#if isHost}
        <div class="ctrl">
          <Button
            onclick={() => send({ type: 'accept', value: live.current?.stats?.median ?? '?' })}
          >
            Accept estimate · {live.current.stats?.median ?? '?'}
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

  .consensus-pane {
    margin-top: 12px;
    padding: 36px 28px 32px;
    background:
      radial-gradient(circle at 50% 0%, rgb(45 211 95 / 0.18), transparent 65%),
      linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border: 1px solid rgb(45 211 95 / 0.3);
    border-radius: var(--radius-xl);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .consensus-tag {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 800;
    color: var(--color-go);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: rgb(45 211 95 / 0.1);
    border: 1px solid rgb(45 211 95 / 0.3);
    padding: 5px 12px;
    border-radius: var(--radius-md);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .consensus-tag .check {
    font-size: 13px;
    line-height: 1;
  }
  .consensus-num {
    font-size: 96px;
    font-weight: 900;
    color: var(--color-bright);
    line-height: 1;
    letter-spacing: -0.05em;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 6px 30px rgb(45 211 95 / 0.35);
  }
  .consensus-meta {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
  }
  .consensus-ctrl {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .secondary .link {
    background: none;
    border: none;
    padding: 0;
    color: var(--color-mid);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .secondary .link:hover {
    color: var(--color-bright);
  }
  .secondary .dot {
    color: var(--color-dim);
  }
  .secondary .hint {
    margin-left: 8px;
    color: var(--color-mid);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .countdown {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--color-go);
    letter-spacing: 0.04em;
  }
  .countdown strong {
    color: var(--color-bright);
    font-variant-numeric: tabular-nums;
  }

  .hero.finalized {
    background:
      radial-gradient(circle at 50% 0%, rgb(45 211 95 / 0.1), transparent 55%),
      var(--color-bg-2);
  }
  .final-pane {
    margin-top: 24px;
    padding: 48px 32px 40px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    background:
      radial-gradient(circle at 50% 0%, rgb(45 211 95 / 0.22), transparent 65%),
      linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border: 1px solid rgb(45 211 95 / 0.3);
    border-radius: var(--radius-xl);
  }
  .final-pane.skipped {
    background:
      radial-gradient(circle at 50% 0%, rgb(233 184 107 / 0.18), transparent 65%),
      linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border-color: rgb(233 184 107 / 0.3);
  }
  .final-tag {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 800;
    color: var(--color-go);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: rgb(45 211 95 / 0.1);
    border: 1px solid rgb(45 211 95 / 0.3);
    padding: 5px 12px;
    border-radius: var(--radius-md);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .final-pane.skipped .final-tag {
    color: var(--color-amber);
    background: rgb(233 184 107 / 0.1);
    border-color: rgb(233 184 107 / 0.3);
  }
  .final-tag .check {
    font-size: 13px;
    line-height: 1;
  }
  .final-story {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-bright);
    letter-spacing: -0.025em;
    margin: 6px 0 0;
  }
  .final-desc {
    color: var(--color-mid);
    font-size: 13px;
    margin: 0;
    max-width: 50ch;
  }
  .final-num {
    font-size: 120px;
    font-weight: 900;
    color: var(--color-bright);
    line-height: 1;
    letter-spacing: -0.05em;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 8px 36px rgb(45 211 95 / 0.4);
    margin: 8px 0;
  }
  .final-pane.skipped .final-num {
    text-shadow: 0 8px 36px rgb(233 184 107 / 0.35);
  }
  .final-skipped-note {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--color-mid);
    letter-spacing: 0.04em;
    padding: 16px 0;
  }
  .final-actions {
    margin-top: 8px;
    display: flex;
    gap: 10px;
  }
  .final-hint {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 11px;
    margin: 6px 0 0;
    letter-spacing: 0.02em;
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
