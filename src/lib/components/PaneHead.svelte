<script lang="ts">
  let { children, hint } = $props<{ children: any; hint?: string }>();
</script>

<div class="ph">{@render children()}{#if hint}<span class="key">{hint}</span>{/if}</div>

<style>
  .ph { font-family: var(--font-mono); font-size: 10px; color: var(--color-mid);
    font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .ph::after { content: ''; flex: 1; height: 1px; background: var(--color-hairline); }
  .key { color: var(--color-amber); font-weight: 700; font-size: 9.5px; padding: 2px 5px;
    background: rgb(233 184 107 / 0.08); border: 1px solid rgb(233 184 107 / 0.18); border-radius: 3px; }
</style>
