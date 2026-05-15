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

      // handleRedirectCallback navigates on success, but `clerk.session`
      // may not be reflected synchronously. Poll a few times before falling
      // through to recovery / error display.
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

      // Clerk's sign-in flow can't auto-create users from a new OAuth identity
      // ("External Account was not found"), and the sign-up flow can't be used
      // when the email already belongs to a user (Clerk reports it as a
      // missing_requirements with email_address listed). Transfer the in-flight
      // OAuth attempt in whichever direction is needed so the user lands in a
      // session regardless of which button they clicked.

      const signInNeedsTransfer = clerk.client?.signIn?.firstFactorVerification?.status === 'transferable'
        || clerk.client?.signIn?.firstFactorVerification?.error?.code === 'external_account_not_found'
        || clerk.client?.signIn?.status === 'needs_identifier';

      if (signInNeedsTransfer && clerk.client?.signUp) {
        status = 'New account — finishing sign-up…';
        try {
          await clerk.client.signUp.create({ transfer: true });
          for (let i = 0; i < 10; i++) {
            if (clerk.session) {
              window.location.assign('/');
              return;
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          dbg.transferSignUpStatus = clerk.client?.signUp?.status ?? null;
          dbg.transferSignUpMissing = clerk.client?.signUp?.missingFields ?? null;
        } catch (te: any) {
          dbg.transferToSignUpError = { name: te?.name, code: te?.code, errors: te?.errors, msg: te?.message };
        }
      }

      // Reverse: signUp got an existing-user collision (sign-up flow with an
      // already-registered Google identity). Clerk surfaces this as a missing
      // email_address in signUp.missingFields rather than a clear error.
      const signUpNeedsTransfer = clerk.client?.signUp?.status === 'missing_requirements'
        && Array.isArray(clerk.client?.signUp?.missingFields)
        && clerk.client.signUp.missingFields.includes('email_address')
        && !clerk.session;

      if (signUpNeedsTransfer) {
        // signIn.create({ transfer: true }) doesn't reliably pick up the OAuth
        // identity off the signUp resource in this Clerk JS version, so just
        // restart the OAuth flow as a sign-in. The Google session is still
        // fresh in the browser, so the user won't see any prompts — Google
        // returns immediately and Clerk's sign-in flow recognizes the existing
        // external account.
        status = 'Existing account — signing you in…';
        try {
          await clerk.client.signIn.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: window.location.origin + '/sign-in/sso-callback',
            redirectUrlComplete: '/'
          });
          // The above triggers a full-page redirect; control won't return here
          // on success. If we somehow continue, fall through to error display.
          return;
        } catch (te: any) {
          dbg.signInRetryError = { name: te?.name, code: te?.code, errors: te?.errors, msg: te?.message };
        }
      }

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
