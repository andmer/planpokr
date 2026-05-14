import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { withClerkHandler } from 'svelte-clerk/server';

// Clerk OAuth sometimes hands the browser a redirect like `//sso-callback`
// (double leading slash), which SvelteKit's router treats as a different
// path from `/sso-callback`. Collapse leading slashes before routing.
const normalizePath: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('//')) {
    const collapsed = event.url.pathname.replace(/^\/+/, '/');
    throw redirect(308, collapsed + event.url.search);
  }
  return resolve(event);
};

// Populates `event.locals.auth` with a session-auth function for every request.
// Call `event.locals.auth()` to get `{ userId, sessionId, ... }`.
export const handle: Handle = sequence(normalizePath, withClerkHandler());
