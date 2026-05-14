<script lang="ts">
  let { value, selected = false, onclick, size = 'sm' } = $props<{
    value: string;
    selected?: boolean;
    onclick?: () => void;
    size?: 'sm' | 'lg';
  }>();
</script>

<button class="pcard size-{size}" class:sel={selected} {onclick}>{value}</button>

<style>
  .pcard {
    border-radius: 7px;
    background: linear-gradient(180deg, var(--color-panel-2), var(--color-panel));
    border: 1px solid var(--color-hairline-strong);
    color: var(--color-text);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), border-color 0.18s, box-shadow 0.2s, background 0.18s, color 0.18s;
    transform-origin: center bottom;
    position: relative;
    box-shadow: var(--shadow-card);
  }
  .size-sm { width: 52px; height: 76px; font-size: 18px; font-weight: 700; }
  .size-lg { width: 64px; height: 94px; font-size: 26px; font-weight: 700; }
  .pcard:hover { transform: scale(1.14) translateY(-6px); border-color: var(--color-mid); color: var(--color-bright); }
  .pcard.sel {
    transform: scale(1.55) translateY(-18px);
    border-color: rgb(255 255 255 / 0.5);
    background: linear-gradient(180deg, #2e2e34, var(--color-panel-2));
    color: var(--color-bright);
    box-shadow: var(--shadow-lift);
    z-index: 2;
  }
  .pcard.sel::after {
    content: ''; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%);
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--color-bright);
    box-shadow: 0 0 8px rgb(255 255 255 / 0.6);
  }
</style>
