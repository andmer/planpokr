<script lang="ts">
  import { SignUp } from 'svelte-clerk';
  import Topbar from '$lib/components/Topbar.svelte';
  import { clerkAppearance } from '$lib/clerkAppearance';
</script>

<Topbar showAuthCTAs />

<main class="wrap">
  <SignUp forceRedirectUrl="/" appearance={clerkAppearance} />
</main>

<style>
  .wrap {
    display: grid;
    place-items: center;
    padding: 64px 20px;
  }
</style>
