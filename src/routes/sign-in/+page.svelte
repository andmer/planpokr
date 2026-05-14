<script lang="ts">
  import { SignIn, GoogleOneTap } from 'svelte-clerk';
  import Topbar from '$lib/components/Topbar.svelte';
  import { clerkAppearance } from '$lib/clerkAppearance';
</script>

<Topbar showAuthCTAs />

<!-- Google One Tap shows a small in-page prompt for users already signed into
     a Google account (uses FedCM where available, no full-page redirect to
     accounts.google.com). The classic SignIn card below is the fallback for
     anyone who dismisses the prompt or isn't signed into Google. -->
<GoogleOneTap signInForceRedirectUrl="/" signUpForceRedirectUrl="/" />

<main class="wrap">
  <!-- forceRedirectUrl is the per-component redirect; the cross-flow
       defaults (sign-up via this widget, etc.) come from PUBLIC_CLERK_*
       env vars on ClerkProvider. -->
  <SignIn forceRedirectUrl="/" appearance={clerkAppearance} />
</main>

<style>
  .wrap {
    display: grid;
    place-items: center;
    padding: 64px 20px;
  }
</style>
