<script lang="ts">
  import Topbar from '$lib/components/Topbar.svelte';
  import PlanningPokerGuide from '$lib/components/PlanningPokerGuide.svelte';

  let { data } = $props();

  const nav = $derived(
    data.signedIn
      ? [
          { label: 'Rooms', href: '/' },
          { label: 'About', href: '/about', active: true }
        ]
      : []
  );
</script>

<Topbar {nav} showUserButton={data.signedIn} showAuthCTAs={!data.signedIn} />

<main class="wrap">
  <header class="page-head">
    <h1>About planpokr</h1>
    <p class="sub">A short field guide to running a clean planning-poker session.</p>
  </header>
  <PlanningPokerGuide />
</main>

<style>
  .wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 56px 24px 96px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }
  .page-head h1 {
    font-size: var(--text-display);
    font-weight: 800;
    letter-spacing: -0.035em;
    color: var(--color-bright);
    margin: 0 0 8px;
  }
  .page-head .sub {
    color: var(--color-mid);
    font-size: 14px;
    margin: 0;
  }
</style>
