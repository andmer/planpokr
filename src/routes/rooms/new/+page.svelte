<script lang="ts">
  import Topbar from '$lib/components/Topbar.svelte';
  import Button from '$lib/components/Button.svelte';
  import type { Deck } from '$lib/types';

  let { data, form } = $props();

  // Initial form values come from `form` (re-render after a failed submit) but
  // are local state once mounted so the inputs stay editable. We deliberately
  // ignore the lint about `form` only being captured initially — that is the
  // intent for restoring user input on validation failure.
  let deck = $state<Deck>('fib');
  let name = $state<string>('');

  $effect(() => {
    if (form?.deck) deck = form.deck as Deck;
    if (typeof form?.name === 'string') name = form.name;
  });

  const user = $derived(
    data.user && data.user.name
      ? { initial: data.user.name.charAt(0).toUpperCase() || '?', name: data.user.name }
      : undefined
  );
</script>

<Topbar showUserButton />
<main class="wrap">
  <h1>New room</h1>
  <form method="POST" class="form">
    <label class="field">
      <span class="label">Name</span>
      <input
        name="name"
        bind:value={name}
        required
        maxlength="80"
        autocomplete="off"
        placeholder="Sprint 42 planning"
      />
    </label>

    <fieldset class="field">
      <legend class="label">Deck</legend>
      <div class="deck-row">
        <label class="deck-opt" class:sel={deck === 'fib'}>
          <input type="radio" name="deck" value="fib" bind:group={deck} hidden />
          Fibonacci · 0 1 2 3 5 8 13 21 ? ☕
        </label>
        <label class="deck-opt" class:sel={deck === 'tshirt'}>
          <input type="radio" name="deck" value="tshirt" bind:group={deck} hidden />
          T-shirt · XS S M L XL ? ☕
        </label>
      </div>
    </fieldset>

    {#if form?.error}<div class="error">{form.error}</div>{/if}

    <div class="actions">
      <Button>Create room</Button>
    </div>
  </form>
</main>

<style>
  .wrap {
    max-width: 520px;
    margin: 48px auto;
    padding: 0 20px;
  }
  h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-bright);
    margin: 0 0 24px;
  }
  .form {
    display: grid;
    gap: 18px;
  }
  .field {
    display: grid;
    gap: 6px;
    border: none;
    padding: 0;
    margin: 0;
  }
  .label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-mid);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  input[name='name'] {
    background: var(--color-bg-2);
    border: 1px solid var(--color-hairline-strong);
    color: var(--color-bright);
    padding: 10px 12px;
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: 13px;
  }
  input[name='name']:focus {
    outline: none;
    border-color: var(--color-cyan);
  }
  .deck-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .deck-opt {
    padding: 8px 14px;
    border-radius: var(--radius-md);
    background: var(--color-panel-2);
    border: 1px solid var(--color-hairline-strong);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text);
  }
  .deck-opt.sel {
    background: linear-gradient(180deg, rgb(130 215 255 / 0.16), rgb(130 215 255 / 0.06));
    color: var(--color-cyan);
    border-color: rgb(130 215 255 / 0.4);
  }
  .error {
    color: var(--color-stop);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
</style>
