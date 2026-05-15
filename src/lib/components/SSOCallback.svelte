<script lang="ts">
  import { untrack } from 'svelte';
  import { useClerkContext } from 'svelte-clerk';

  // Clerk's handleRedirectCallback handles the happy paths (existing user
  // signing in, new user signing up via the sign-up flow). It does NOT
  // auto-handle two cases that this app is configured to allow:
  //   1. New OAuth identity returning to /sign-in/sso-callback
  //      → must signUp.create({transfer:true}) then setActive
  //   2. Existing OAuth identity returning to /sign-up/sso-callback
  //      → must relaunch as signIn.authenticateWithRedirect (the Google
  //        session is fresh so the user sees no prompt)
  // Both are intrinsic to Clerk JS as of clerk-js v5; passing signInUrl /
  // signUpUrl to handleRedirectCallback doesn't change this behavior.
  const ctx = useClerkContext();
  let status = $state('Finishing sign-in…');
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
    const dbg: Record<string, unknown> = { url: window.location.href };
    try {
      if (clerk.session) {
        window.location.assign('/');
        return;
      }

      await clerk.handleRedirectCallback({
        signInUrl: '/sign-in',
        signUpUrl: '/sign-up',
        continueSignUpUrl: '/sign-up',
        signInForceRedirectUrl: '/',
        signUpForceRedirectUrl: '/',
        signInFallbackRedirectUrl: '/',
        signUpFallbackRedirectUrl: '/'
      });

      // Settle: poll briefly until we have a session, an actionable transfer
      // signal, or a session ID Clerk created without activating.
      let action: 'forward' | 'reverse' | null = null;
      for (let i = 0; i < 20; i++) {
        if (clerk.session) {
          window.location.assign('/');
          return;
        }
        const createdSessionId =
          clerk.client?.signIn?.createdSessionId ?? clerk.client?.signUp?.createdSessionId;
        if (createdSessionId && typeof clerk.setActive === 'function') {
          await clerk.setActive({ session: createdSessionId, redirectUrl: '/' });
          return;
        }
        const si = clerk.client?.signIn;
        const su = clerk.client?.signUp;
        if (
          si?.firstFactorVerification?.status === 'transferable' ||
          si?.firstFactorVerification?.error?.code === 'external_account_not_found' ||
          si?.status === 'needs_identifier'
        ) {
          action = 'forward';
          break;
        }
        if (
          su?.status === 'missing_requirements' &&
          Array.isArray(su?.missingFields) &&
          su.missingFields.includes('email_address')
        ) {
          action = 'reverse';
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      if (action === 'forward' && clerk.client?.signUp) {
        status = 'Creating account…';
        const result = await clerk.client.signUp.create({ transfer: true });
        const sid = result?.createdSessionId ?? clerk.client?.signUp?.createdSessionId;
        if (sid && typeof clerk.setActive === 'function') {
          await clerk.setActive({ session: sid, redirectUrl: '/' });
          return;
        }
        if (clerk.session) {
          window.location.assign('/');
          return;
        }
        dbg.forwardTransferStatus = clerk.client?.signUp?.status ?? null;
        dbg.forwardTransferMissing = clerk.client?.signUp?.missingFields ?? null;
      } else if (action === 'reverse') {
        status = 'Signing you in…';
        // Re-launch OAuth as a sign-in. The Google/GitHub session is still
        // fresh so the provider returns instantly and Clerk recognizes the
        // existing external account on the sign-in flow.
        const strategy = detectStrategy(clerk);
        if (strategy) {
          await clerk.client.signIn.authenticateWithRedirect({
            strategy,
            redirectUrl: window.location.origin + '/sign-in/sso-callback',
            redirectUrlComplete: '/'
          });
          return; // full-page redirect
        }
        dbg.reverseTransferNoStrategy = true;
      }

      dbg.afterCallback_session = !!clerk.session;
      dbg.signInStatus = clerk.client?.signIn?.status ?? null;
      dbg.signUpStatus = clerk.client?.signUp?.status ?? null;
      dbg.signUpMissing = clerk.client?.signUp?.missingFields ?? null;
      status = 'Handshake finished without a session.';
      error =
        'Clerk did not return an active session. Check that the OAuth provider ' +
        'is enabled for both sign-in and sign-up on the Clerk Dashboard, and that ' +
        '(' + window.location.origin + ') is an allowed origin.';
    } catch (e: any) {
      status = 'Error during sign-in.';
      error = e?.message ?? String(e);
      dbg.errorObject = { name: e?.name, code: e?.code, errors: e?.errors };
    } finally {
      debugLine = JSON.stringify(dbg);
      console.warn('[sso-callback]', dbg);
    }
  }

  // Figure out which OAuth strategy was just used so we can re-launch it.
  // Clerk stores it on the signUp resource's verifications.
  function detectStrategy(clerk: any): string | null {
    const v = clerk.client?.signUp?.verifications;
    const ext = v?.externalAccount;
    if (ext?.strategy) return ext.strategy;
    const oauthKey = Object.keys(v ?? {}).find((k) => k.startsWith('oauth_'));
    return oauthKey ?? null;
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
