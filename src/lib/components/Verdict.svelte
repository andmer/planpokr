<script lang="ts">
  type Kind = 'consensus' | 'no-consensus' | 'skipped';
  let { kind, value } = $props<{ kind: Kind; value?: string }>();
  const label = kind === 'consensus' ? `CONSENSUS${value ? ` → ${value}` : ''}`
              : kind === 'no-consensus' ? 'NO CONSENSUS'
              : 'SKIPPED';
</script>

<span class="v kind-{kind}">{label}</span>

<style>
  .v {
    padding: 3px 9px;
    border-radius: var(--radius-md);
    font-weight: 800;
    letter-spacing: 0.08em;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--color-bright);
  }
  .kind-consensus {
    background: linear-gradient(180deg, var(--color-go-bright), var(--color-go));
    box-shadow: 0 4px 12px -2px rgb(45 211 95 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.18);
  }
  .kind-no-consensus {
    background: linear-gradient(180deg, #f25555, var(--color-stop));
    box-shadow: var(--shadow-stop);
  }
  .kind-skipped {
    background: linear-gradient(180deg, #6e6e76, #4a4a52);
    box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.4);
  }
</style>
