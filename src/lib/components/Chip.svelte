<script lang="ts">
  let { initial, value, role = 'default', state = 'neutral' } = $props<{
    initial: string;
    value: string;
    role?: 'default' | 'host' | 'you';
    state?: 'neutral' | 'consensus' | 'divergent';
  }>();
</script>

<span class="chip role-{role} state-{state}">
  <span class="a">{initial}</span>
  <span class="v">{value}</span>
</span>

<style>
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 8px 3px 3px;
    background: var(--color-panel-2);
    border: 1px solid var(--color-hairline-strong);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 11px; font-weight: 600;
  }
  .a {
    width: 20px; height: 20px; border-radius: 3px;
    background: var(--color-panel-3); color: var(--color-text);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 9.5px; font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .role-host .a { background: linear-gradient(135deg, var(--color-mauve), #a085e8); color: var(--color-ink); }
  .role-you  .a { background: linear-gradient(135deg, var(--color-pink), #d96b85); color: var(--color-ink); }
  .v { color: var(--color-bright); font-weight: 700; font-variant-numeric: tabular-nums; }
  .state-divergent .v { color: var(--color-pink); }
  .state-consensus .v { color: var(--color-go); }
</style>
