<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { useClerkContext } from 'svelte-clerk';

  const ctx = useClerkContext();
  let error = $state<string | null>(null);

  $effect(() => {
    const clerk = ctx.clerk;
    if (!clerk) return;

    (async () => {
      try {
        // If a session is already live (Clerk set the cookie during the
        // accounts.dev handshake), skip the OAuth callback and go home.
        if (clerk.session) {
          await goto('/', { invalidateAll: true });
          return;
        }

        await clerk.handleRedirectCallback({
          signInForceRedirectUrl: '/',
          signUpForceRedirectUrl: '/',
          signInFallbackRedirectUrl: '/',
          signUpFallbackRedirectUrl: '/'
        });

        // If we're still here after handleRedirectCallback resolves, the
        // session is in place but Clerk didn't navigate for us. Force it.
        if (clerk.session) {
          await goto('/', { invalidateAll: true });
        }
      } catch (e: any) {
        error = e?.message ?? String(e);
      }
    })();
  });
</script>

<main style="display:grid;place-items:center;min-height:60vh;text-align:center">
  {#if error}
    <div style="max-width:540px">
      <h2 style="font-family:var(--font-mono);font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-stop)">Sign-in error</h2>
      <pre style="margin-top:12px;color:var(--color-mid);white-space:pre-wrap;font-family:var(--font-mono);font-size:12px">{error}</pre>
      <a href="/" style="display:inline-block;margin-top:16px;color:var(--color-go);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase">Back to home</a>
    </div>
  {:else}
    <p style="color:var(--color-mid);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase">Signing you in…</p>
  {/if}
</main>
