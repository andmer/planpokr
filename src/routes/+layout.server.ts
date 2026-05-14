import type { LayoutServerLoad } from './$types';
import { clerkClient } from 'svelte-clerk/server';
import { upsertUser } from '$lib/server/db';

// Mirror the Clerk user into D1 on every authenticated hit so other server
// code (room CRUD, history queries) can join against a local `users` row
// without hitting Clerk per request.
//
// Note: svelte-clerk's `event.locals.auth` is a function returning the session
// auth object. The plan referenced `auth.user()` as a helper, but that is not
// exposed by the installed `svelte-clerk@1.1.x`. We fetch the profile via
// `clerkClient.users.getUser(userId)` from `@clerk/backend` (re-exported by
// `svelte-clerk/server`) instead.
export const load: LayoutServerLoad = async (event) => {
  const auth = event.locals.auth();
  if (!auth?.userId) {
    // Unauthenticated → landing page will render the Clerk sign-in widget.
    return { user: null };
  }

  const clerkUser = await clerkClient.users.getUser(auth.userId);
  const displayName =
    clerkUser.firstName ?? clerkUser.username ?? clerkUser.id.slice(0, 8);

  if (event.platform?.env?.DB) {
    await upsertUser(event.platform.env.DB, {
      id: clerkUser.id,
      display_name: displayName,
      avatar_url: clerkUser.imageUrl ?? null,
      created_at: Date.now()
    });
  }

  return {
    user: {
      id: clerkUser.id,
      name: displayName,
      avatar: clerkUser.imageUrl ?? null
    }
  };
};
