<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { ClerkProvider } from 'svelte-clerk';
  import { dark } from '@clerk/themes';
  import { browser } from '$app/environment';

  let { children, data } = $props();

  // Theme Clerk's hosted pages + embedded widgets to match planpokr's palette
  // (Tokyo-Night-derived dark surface, green primary, semantic accents).
  // Any colour we tweak here only changes Clerk's UI — the rest of the app
  // continues to consume `var(--color-*)` from src/lib/theme/tokens.css.
  // Keep the dark baseTheme intact (it gets text contrast right by itself).
  // Only override the brand accent + radius + font so the surfaces feel native.
  const appearance = {
    baseTheme: dark,
    variables: {
      colorPrimary: '#2dd35f',          // --color-go (Reveal button green)
      colorDanger: '#ef4444',           // --color-stop
      borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyButtons: 'Inter, system-ui, sans-serif'
    }
  };

  // Patch Clerk.signOut so any caller (popover Sign-out, programmatic
  // sign-out, anywhere) reliably ends with a full-page reload.
  //
  // Why this is needed: svelte-clerk wires Clerk's routerPush to SvelteKit's
  // goto(). After signOut, Clerk calls routerPush('/'). When the user is
  // already on /, goto('/') is a no-op — the session clears server-side and
  // client-side, but the page never re-runs its load functions, so the
  // signed-in shell lingers (rooms still listed, UserButton empty). A
  // session-listener approach didn't fire reliably here either. Wrapping
  // signOut() itself is the most direct fix: whenever it completes, force a
  // reload (or full navigation if we need to leave the current path).
  onMount(() => {
    if (!browser) return;
    let cancelled = false;

    const patch = () => {
      const clerk = window.Clerk as unknown as { signOut?: (...a: unknown[]) => Promise<unknown>; __planpokr_patched?: boolean };
      if (!clerk?.signOut || clerk.__planpokr_patched) return !!clerk?.signOut;
      const original = clerk.signOut.bind(clerk);
      clerk.signOut = async (...args: unknown[]) => {
        try {
          await original(...args);
        } catch {
          // fall through — cookie was almost certainly cleared anyway
        }
        const path = window.location.pathname + window.location.search;
        if (path === '/' || path === '') {
          window.location.reload();
        } else {
          window.location.href = '/';
        }
      };
      clerk.__planpokr_patched = true;
      return true;
    };

    if (!patch()) {
      const id = setInterval(() => {
        if (cancelled || patch()) clearInterval(id);
      }, 100);
      setTimeout(() => clearInterval(id), 10000);
    }
    return () => { cancelled = true; };
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://rsms.me/" />
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono/web/woff2/JetBrainsMono.css" />
</svelte:head>

<!-- afterSignOutUrl is a ClerkProvider/instance option, not a <UserButton /> prop —
     passing it on UserButton is silently ignored. Setting it here makes the
     popover's "Sign out" action redirect back to the unauthenticated landing. -->
<ClerkProvider initialState={data.initialState} {appearance} afterSignOutUrl="/">
  {@render children()}
</ClerkProvider>
