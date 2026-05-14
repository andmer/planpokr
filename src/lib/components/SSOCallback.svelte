<script lang="ts">
  import { untrack } from 'svelte';
  import { useClerkContext } from 'svelte-clerk';

  const ctx = useClerkContext();
  let status = $state('Loading Clerk…');

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

      dbg.afterCallback_session = !!clerk.session;
      dbg.afterCallback_user = !!clerk.user;
      dbg.signInStatus = clerk.client?.signIn?.status ?? null;
      dbg.signInMissing = clerk.client?.signIn?.missingFields ?? null;
      dbg.signUpStatus = clerk.client?.signUp?.status ?? null;
      dbg.signUpMissing = clerk.client?.signUp?.missingFields ?? null;
      dbg.signUpUnverified = clerk.client?.signUp?.unverifiedFields ?? null;

      if (clerk.session) {
        status = 'Sign-in complete — redirecting…';
        window.location.assign('/');
        return;
      }

      await resetAndRetry(clerk, 'Handshake finished without a session.');
    } catch (e: any) {
      dbg.errorObject = { name: e?.name, code: e?.code, errors: e?.errors };
      await resetAndRetry(clerk, e?.message ?? String(e));
    } finally {
      // Keep raw diagnostics reachable for triage; the UI now auto-resets so
      // there's no on-screen surface for them.
      console.warn('[sso-callback]', dbg);
    }
  }

  async function resetAndRetry(clerk: any, reason: string) {
    status = `${reason} Resetting…`;
    try {
      await clerk.signOut();
    } catch {
      /* signOut may throw if there's no active session; that's fine */
    }
    try {
      for (const store of [window.localStorage, window.sessionStorage]) {
        const keys: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && (k.startsWith('clerk-') || k.startsWith('__clerk'))) keys.push(k);
        }
        for (const k of keys) store.removeItem(k);
      }
    } catch {
      /* storage may be unavailable (private mode, etc.) */
    }
    setTimeout(() => {
      window.location.replace('/sign-in?reset=1');
    }, 800);
  }
</script>

<main style="display:grid;place-items:center;min-height:60vh;padding:24px">
  <div style="max-width:640px;text-align:center">
    <p style="color:var(--color-mid);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase">{status}</p>
  </div>
</main>
