import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { createRoom, listUserRooms } from '$lib/server/db';
import { generateSlug } from '$lib/server/slug';
import type { Deck } from '$lib/types';

// `svelte-clerk@1.1.x` exposes `event.locals.auth` as a function returning the
// session auth object, not the object itself. Always call `locals.auth()` here.
export const GET: RequestHandler = async ({ locals, platform }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw error(401);
  const rooms = await listUserRooms(platform!.env.DB, auth.userId);
  return json(rooms.results);
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw error(401);

  const body = (await request.json()) as { name?: string; deck?: Deck };
  if (!body.name?.trim()) throw error(400, 'name required');
  if (!body.deck || !['fib', 'tshirt'].includes(body.deck)) {
    throw error(400, 'invalid deck');
  }

  const room = {
    id: generateSlug(),
    name: body.name.trim().slice(0, 80),
    deck: body.deck,
    host_user_id: auth.userId,
    created_at: Date.now(),
    archived_at: null
  };
  await createRoom(platform!.env.DB, room);
  return json(room, { status: 201 });
};
