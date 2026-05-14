<script lang="ts">
  type Variant = 'primary' | 'ghost' | 'danger' | 'danger-solid';
  let { variant = 'primary', onclick, children, disabled = false } = $props<{
    variant?: Variant;
    onclick?: () => void;
    disabled?: boolean;
    children: any;
  }>();
</script>

<button
  class="btn variant-{variant}"
  class:disabled
  {onclick}
  {disabled}
><span>{@render children()}</span></button>

<style>
  .btn {
    padding: 11px 22px;
    border-radius: var(--radius-md);
    border: 1px solid;
    font-weight: 700;
    font-size: 12.5px;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: transform 0.14s, filter 0.14s;
  }
  .btn:hover { transform: translateY(-1px); filter: brightness(1.06); }
  .btn.disabled { opacity: 0.4; pointer-events: none; }

  .variant-primary {
    background: linear-gradient(180deg, var(--color-go-bright), var(--color-go));
    color: var(--color-bright);
    border-color: var(--color-go);
    box-shadow: var(--shadow-go);
  }
  .variant-ghost {
    background: transparent;
    color: var(--color-text);
    border-color: var(--color-hairline-strong);
    font-weight: 600;
  }
  .variant-ghost:hover { background: var(--color-panel-2); color: var(--color-bright); filter: none; }
  .variant-danger {
    background: transparent;
    color: var(--color-stop);
    border-color: rgb(239 68 68 / 0.4);
  }
  .variant-danger-solid {
    background: linear-gradient(180deg, #f25555, var(--color-stop));
    color: var(--color-bright);
    border-color: var(--color-stop);
    box-shadow: var(--shadow-stop);
  }
</style>
