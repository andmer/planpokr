<script lang="ts">
  let { items = [], right } = $props<{
    items?: { key: string; label: string }[];
    right?: string;
  }>();
</script>

<footer class="statusbar hairline-top">
  {#each items as it}<span class="item"><kbd>{it.key}</kbd> {it.label}</span>{/each}
  {#if right}<span class="right">{right}</span>{/if}
</footer>

<style>
  .statusbar { display: flex; align-items: center; gap: 18px; padding: 10px 20px;
    background: linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border-top: 1px solid var(--color-hairline);
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-mid); }
  kbd { color: var(--color-amber); background: var(--color-bg); border: 1px solid var(--color-hairline-strong);
    border-radius: var(--radius-sm); padding: 2px 6px; margin-right: 5px; font-weight: 700;
    box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.4); font-family: var(--font-mono); }
  .right { margin-left: auto; color: var(--color-go); font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
