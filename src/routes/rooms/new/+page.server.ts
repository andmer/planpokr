import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createRoom } from '$lib/server/db';
import { generateSlug } from '$lib/server/slug';
import type { Deck } from '$lib/types';

// `svelte-clerk@1.1.x` exposes `locals.auth` as a function. Always call it.
export const actions: Actions = {
  default: async ({ locals, platform, request }) => {
    const auth = locals.auth();
    if (!auth?.userId) throw redirect(302, '/');

    const data = await request.formData();
    const name = ((data.get('name') as string) ?? '').trim();
    const deck = data.get('deck') as Deck | null;

    if (!name) return fail(400, { error: 'Name required', name, deck });
    if (!deck || !['fib', 'tshirt'].includes(deck)) {
      return fail(400, { error: 'Invalid deck', name, deck });
    }
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database unavailable', name, deck });
    }

    const room = {
      id: generateSlug(),
      name: name.slice(0, 80),
      deck,
      host_user_id: auth.userId,
      created_at: Date.now(),
      archived_at: null
    };
    await createRoom(platform.env.DB, room);
    throw redirect(303, `/r/${room.id}`);
  }
};
