<script lang="ts">
  let { children, danger = false, padding = 'lg' } = $props();
</script>

<div class="card hairline-top" class:danger class:p-lg={padding === 'lg'} class:p-md={padding === 'md'}>
  {@render children()}
</div>

<style>
  .card { background: linear-gradient(180deg, var(--color-panel) 0%, rgb(20 20 22 / 0.92) 100%);
    border: 1px solid var(--color-hairline); border-radius: var(--radius-xl); position: relative; }
  .p-md { padding: 16px 18px; }
  .p-lg { padding: 22px 24px 24px; }
  .danger { border-color: rgb(239 68 68 / 0.2); }
  .danger::before { background: linear-gradient(90deg, transparent, rgb(239 68 68 / 0.5), transparent) !important; }
</style>
