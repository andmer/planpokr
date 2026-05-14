import type { Handle } from '@sveltejs/kit';
import { withClerkHandler } from 'svelte-clerk/server';

// Populates `event.locals.auth` with a session-auth function for every request.
// Call `event.locals.auth()` to get `{ userId, sessionId, ... }`.
export const handle: Handle = withClerkHandler();
