<script lang="ts">
  import Topbar from '$lib/components/Topbar.svelte';
  import HistoryStrip from '$lib/components/HistoryStrip.svelte';
  import { computeStats } from '$lib/stats';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type Verdict = 'consensus' | 'no-consensus' | 'skipped';

  // A round is `skipped` when it was never revealed (no audit votes).
  // Otherwise the verdict comes from the actual cast values.
  const verdictOf = (
    round: PageData['stories'][number]['rounds'][number]
  ): Verdict => {
    if (!round.revealed_at) return 'skipped';
    if (round.accepted_estimate) return 'consensus';
    const stats = computeStats(
      Object.fromEntries(round.votes.map((v) => [v.user_id, v.value]))
    );
    return stats.verdict;
  };

  const initialOf = (name: string) =>
    (name?.[0] ?? '?').toUpperCase();

  const isVisibleStory = (s: PageData['stories'][number]) =>
    s.status === 'estimated' || s.status === 'skipped';
</script>

<Topbar
  breadcrumb={[{ label: data.room.id, kind: 'room' }]}
  nav={[
    { label: 'Room' },
    { label: 'History', active: true },
    { label: 'Settings' }
  ]}
  showUserButton
/>

<main>
  <h1>History</h1>

  {#each data.stories.filter(isVisibleStory) as story (story.id)}
    <article class="story">
      <header>
        <div class="estimate">
          <div class="lbl">Estimate</div>
          <div class="num">{story.final_estimate ?? '—'}</div>
        </div>
        <div class="title-wrap">
          <div class="title">{story.title}</div>
          {#if story.description}
            <div class="desc">{story.description}</div>
          {/if}
        </div>
        <div class="meta">
          {story.rounds.length} round{story.rounds.length === 1 ? '' : 's'} · {story.status}
        </div>
      </header>
      <div class="rounds">
        {#each story.rounds as round (round.id)}
          {@const stats = computeStats(
            Object.fromEntries(round.votes.map((v) => [v.user_id, v.value]))
          )}
          {@const verdict = verdictOf(round)}
          <HistoryStrip
            rounds={[
              {
                num: round.round_number,
                votes: round.votes.map((v) => ({
                  initial: initialOf(v.display_name),
                  value: v.value,
                  role:
                    v.user_id === data.you.userId
                      ? 'you'
                      : v.user_id === data.room.host_user_id
                        ? 'host'
                        : 'default',
                  state:
                    verdict === 'consensus' ? 'consensus' : 'divergent'
                })),
                median: stats.median,
                range: stats.range,
                verdict,
                estimate: round.accepted_estimate ?? undefined
              }
            ]}
          />
        {/each}
        {#if !story.rounds.length}
          <div class="empty">No rounds recorded.</div>
        {/if}
      </div>
    </article>
  {:else}
    <div class="empty">No estimated or skipped stories yet.</div>
  {/each}
</main>

<style>
  main {
    padding: 32px 36px 40px;
  }
  h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-bright);
    letter-spacing: -0.03em;
    margin: 0 0 24px;
  }
  .story {
    background: linear-gradient(
      180deg,
      var(--color-panel),
      rgb(20 20 22 / 0.92)
    );
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    margin-bottom: 14px;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-hairline);
  }
  .estimate {
    min-width: 60px;
  }
  .estimate .lbl {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-mid);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .estimate .num {
    font-size: 28px;
    font-weight: 800;
    color: var(--color-bright);
    font-variant-numeric: tabular-nums;
  }
  .title-wrap {
    flex: 1;
  }
  .title {
    color: var(--color-bright);
    font-size: 15px;
    font-weight: 700;
  }
  .desc {
    color: var(--color-mid);
    font-size: 12px;
    margin-top: 2px;
  }
  .meta {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--color-dim);
    text-align: right;
  }
  .rounds {
    padding: 12px 20px 14px;
    background: var(--color-bg-2);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .empty {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 16px 0;
  }
</style>
