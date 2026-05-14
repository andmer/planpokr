<script lang="ts">
  import Chip from './Chip.svelte';
  import Verdict from './Verdict.svelte';
  type Vote = { initial: string; value: string; role?: 'default' | 'host' | 'you'; state: 'consensus' | 'divergent' };
  type Round = { num: number; votes: Vote[]; median: string; range: string; verdict: 'consensus' | 'no-consensus' | 'skipped'; estimate?: string };
  let { rounds } = $props<{ rounds: Round[] }>();
</script>

<div class="strip hairline-top">
  {#each rounds as round, i}
    <div class="row" class:first={i === 0}>
      <span class="label" class:accepted={round.verdict === 'consensus'}>R{round.num}</span>
      <div class="chips">{#each round.votes as v}<Chip {...v} />{/each}</div>
      <div class="summary">
        <span>median <span class="num">{round.median}</span></span>
        <span>range <span class="num">{round.range}</span></span>
        <Verdict kind={round.verdict} value={round.estimate} />
      </div>
    </div>
  {/each}
</div>

<style>
  .strip { padding: 16px 18px; background: linear-gradient(180deg, var(--color-panel), var(--color-bg-2));
    border: 1px solid var(--color-hairline); border-radius: var(--radius-lg); position: relative; }
  .row { display: flex; align-items: center; gap: 14px; padding: 6px 0; }
  .row + .row { border-top: 1px solid var(--color-hairline); margin-top: 6px; padding-top: 12px; }
  .label { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--color-amber);
    background: rgb(233 184 107 / 0.08); border: 1px solid rgb(233 184 107 / 0.25);
    padding: 4px 8px; border-radius: var(--radius-md); min-width: 32px; text-align: center; }
  .label.accepted { color: var(--color-go); background: rgb(45 211 95 / 0.08); border-color: rgb(45 211 95 / 0.3); }
  .chips { display: flex; gap: 5px; flex: 1; flex-wrap: wrap; }
  .summary { display: flex; gap: 14px; align-items: center; margin-left: auto;
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; color: var(--color-mid); }
  .num { color: var(--color-cyan); font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
