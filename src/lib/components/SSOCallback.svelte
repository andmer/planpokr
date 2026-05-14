<script lang="ts">
  import { untrack } from 'svelte';
  import { useClerkContext } from 'svelte-clerk';

  const ctx = useClerkContext();
  let status = $state('Loading Clerk…');
  let error = $state<string | null>(null);
  let debugLine = $state('');

  let ran = false;

  $effect(() => {
    const clerk = ctx.clerk;
    if (!clerk || ran) return;
    ran = true;

    untrack(() => {
      runCallback(clerk);
    });
  });

  async function runCallback(clerk: any) {
    const dbg: Record<string, unknown> = {
      hasClerk: true,
      hasInitialSession: !!clerk.session,
      url: window.location.href
    };
    status = 'Clerk loaded — checking session…';

    try {
      if (clerk.session) {
        status = 'Session active — redirecting…';
        window.location.assign('/');
        return;
      }

      status = 'Processing OAuth callback…';
      await clerk.handleRedirectCallback({
        signInForceRedirectUrl: '/',
        signUpForceRedirectUrl: '/',
        signInFallbackRedirectUrl: '/',
        signUpFallbackRedirectUrl: '/'
      });

      // Clerk's handleRedirectCallback navigates the page on success, but the
      // session may not be reflected on `clerk.session` synchronously. Poll a
      // few times before declaring failure so a slow propagation doesn't
      // trigger the error fallback (which previously destroyed real sessions).
      for (let i = 0; i < 10; i++) {
        if (clerk.session) {
          status = 'Sign-in complete — redirecting…';
          window.location.assign('/');
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      dbg.afterCallback_session = !!clerk.session;
      dbg.afterCallback_user = !!clerk.user;
      dbg.signInStatus = clerk.client?.signIn?.status ?? null;
      dbg.signInMissing = clerk.client?.signIn?.missingFields ?? null;
      dbg.signUpStatus = clerk.client?.signUp?.status ?? null;
      dbg.signUpMissing = clerk.client?.signUp?.missingFields ?? null;
      dbg.signUpUnverified = clerk.client?.signUp?.unverifiedFields ?? null;

      status = 'Handshake finished without a session.';
      error =
        'Clerk did not return an active session. Likely causes:\n' +
        '  1) The Clerk instance does not list this origin (' +
        window.location.origin +
        ') as an allowed redirect URL.\n' +
        '  2) The OAuth provider (e.g. Google) is not enabled on the Clerk instance.\n' +
        '  3) Cookies were blocked (third-party cookie settings).';
    } catch (e: any) {
      status = 'Error during sign-in.';
      error = e?.message ?? String(e);
      dbg.errorObject = { name: e?.name, code: e?.code, errors: e?.errors };
    } finally {
      debugLine = JSON.stringify(dbg);
      console.warn('[sso-callback]', dbg);
    }
  }
</script>

<main style="display:grid;place-items:center;min-height:60vh;padding:24px">
  <div style="max-width:640px;text-align:center">
    <p style="color:var(--color-mid);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase">{status}</p>
    {#if error}
      <pre style="margin-top:24px;color:var(--color-stop);white-space:pre-wrap;text-align:left;font-family:var(--font-mono);font-size:12px;background:var(--color-panel);padding:14px;border-radius:var(--radius-md);border:1px solid var(--color-hairline-strong)">{error}</pre>
      {#if debugLine}
        <div style="margin-top:14px;color:var(--color-mid);font-family:var(--font-mono);font-size:10px;word-break:break-all">debug: {debugLine}</div>
      {/if}
      <a href="/" style="display:inline-block;margin-top:18px;color:var(--color-go);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase">← Back to home</a>
    {/if}
  </div>
</main>
