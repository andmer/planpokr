<script lang="ts">
  // Thin wrapper around Clerk's official OAuth callback handler. Clerk JS
  // handles every case here (sign-in / sign-up / transfer between them)
  // when the Dashboard has "Enable for sign-up" turned on for each social
  // connection. Do NOT reintroduce custom transfer logic — it fights
  // Clerk's internal state machine and breaks across clerk-js versions.
  import { AuthenticateWithRedirectCallback } from 'svelte-clerk';
</script>

<AuthenticateWithRedirectCallback
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  continueSignUpUrl="/sign-up"
  signInForceRedirectUrl="/"
  signUpForceRedirectUrl="/"
  signInFallbackRedirectUrl="/"
  signUpFallbackRedirectUrl="/"
/>

<main style="display:grid;place-items:center;min-height:60vh;padding:24px">
  <p style="color:var(--color-mid);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase">
    Finishing sign-in…
  </p>
</main>
