<script lang="ts">
  import Topbar from '$lib/components/Topbar.svelte';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<Topbar
  breadcrumb={[{ label: data.room.id, kind: 'room' }]}
  nav={[
    { label: 'Room' },
    { label: 'History' },
    { label: 'Settings', active: true }
  ]}
  showUserButton
/>

<main>
  <h1>Settings</h1>

  <Card>
    <div class="section-title">Room</div>
    <p class="section-desc">Basic information visible to everyone.</p>

    <form method="POST" action="?/rename" class="row">
      <span class="lbl">Name</span>
      <input name="name" value={data.room.name} class="input" />
      <Button variant="ghost">Save</Button>
    </form>

    <form method="POST" action="?/setDeck" class="row top-border">
      <span class="lbl">Deck</span>
      <select name="deck" class="input">
        <option value="fib" selected={data.room.deck === 'fib'}>Fibonacci</option>
        <option value="tshirt" selected={data.room.deck === 'tshirt'}>T-shirt</option>
      </select>
      <Button variant="ghost">Save</Button>
    </form>
  </Card>

  <Card>
    <div class="section-title">Members</div>
    {#each data.members as m (m.user_id)}
      <div class="member">
        <Avatar
          initial={(m.display_name?.[0] ?? '?').toUpperCase()}
          role={m.role === 'host' ? 'host' : 'default'}
        />
        <span class="member-name">{m.display_name}</span>
        <span class="member-role">{m.role}</span>
      </div>
    {/each}
  </Card>

  <Card danger>
    <div class="danger-badge">DANGER ZONE</div>
    <div class="danger-stack">
      <form method="POST" action="?/archive" class="danger-row">
        <div class="danger-text">
          <div class="danger-title">Archive room</div>
          <div class="danger-desc">History is preserved.</div>
        </div>
        <Button variant="danger">Archive</Button>
      </form>
      <form method="POST" action="?/remove" class="danger-row top-border">
        <div class="danger-text">
          <div class="danger-title">Delete room</div>
          <div class="danger-desc">Permanently delete. Cannot be undone.</div>
        </div>
        <Button variant="danger-solid">Delete room</Button>
      </form>
    </div>
  </Card>
</main>

<style>
  main {
    padding: 32px 36px 40px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-bright);
    letter-spacing: -0.03em;
    margin: 0 0 10px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-bright);
    margin-bottom: 4px;
  }
  .section-desc {
    color: var(--color-mid);
    margin: 0 0 14px;
    font-size: 13px;
  }
  .row {
    display: grid;
    grid-template-columns: 120px 1fr auto;
    gap: 16px;
    align-items: center;
    padding: 10px 0;
  }
  .top-border {
    border-top: 1px solid var(--color-hairline);
  }
  .lbl {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--color-mid);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .input {
    background: var(--color-bg-2);
    border: 1px solid var(--color-hairline-strong);
    color: var(--color-bright);
    padding: 9px 12px;
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 600;
    max-width: 360px;
  }
  .member {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--color-hairline);
  }
  .member:first-child {
    border-top: none;
  }
  .member-name {
    flex: 1;
    font-weight: 700;
    color: var(--color-bright);
  }
  .member-role {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-mid);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .danger-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 800;
    color: var(--color-stop);
    background: rgb(239 68 68 / 0.1);
    border: 1px solid rgb(239 68 68 / 0.3);
    padding: 4px 10px;
    border-radius: var(--radius-md);
    display: inline-block;
    margin-bottom: 8px;
    letter-spacing: 0.1em;
  }
  .danger-stack {
    display: flex;
    flex-direction: column;
  }
  .danger-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 0;
  }
  .danger-text {
    flex: 1;
  }
  .danger-title {
    color: var(--color-bright);
    font-weight: 700;
  }
  .danger-desc {
    color: var(--color-mid);
    font-size: 12px;
  }
</style>
