<script lang="ts">
  let { initial, role = 'default', size = 'md' } = $props<{
    initial: string;
    role?: 'default' | 'host' | 'you';
    size?: 'sm' | 'md';
  }>();
</script>

<div class="avatar size-{size} role-{role}" class:host={role === 'host'} class:you={role === 'you'}>{initial}</div>

<style>
  .avatar {
    border-radius: var(--radius-md);
    display: inline-flex; align-items: center; justify-content: center;
    font-family: var(--font-mono);
    font-weight: 800;
    border: 1px solid var(--color-hairline-strong);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
    background: linear-gradient(135deg, var(--color-panel-3), var(--color-panel-2));
    color: var(--color-text);
  }
  .size-sm { width: 22px; height: 22px; font-size: 9.5px; }
  .size-md { width: 28px; height: 28px; font-size: 12px; }
  .host { background: linear-gradient(135deg, var(--color-mauve), #9b7de0); color: var(--color-ink); border-color: transparent;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25), 0 2px 8px rgb(196 167 250 / 0.25); }
  .you  { background: linear-gradient(135deg, var(--color-pink), #d56a85); color: var(--color-ink); border-color: transparent;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25), 0 2px 8px rgb(245 125 150 / 0.25); }
</style>
