<script lang="ts">
  let { children } = $props();
</script>

<kbd class="keycap">{@render children()}</kbd>

<style>
  .keycap {
    color: var(--color-amber);
    background: var(--color-panel-2);
    border: 1px solid var(--color-hairline-strong);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    margin-right: 3px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.3);
  }
</style>
