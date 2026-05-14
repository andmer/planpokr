import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { getRoom, listUserRooms } from '$lib/server/db';

// `svelte-clerk@1.1.x` exposes `locals.auth` as a function. Always call it.
export const load: PageServerLoad = async ({ locals, platform }) => {
  const auth = locals.auth();
  if (!auth?.userId) {
    return { signedIn: false as const, rooms: [] };
  }
  if (!platform?.env?.DB) {
    return { signedIn: true as const, rooms: [] };
  }
  const rooms = await listUserRooms(platform.env.DB, auth.userId);
  return { signedIn: true as const, rooms: rooms.results };
};

// Host-only soft-delete from the rooms list. Mirrors the `archive` action on
// /r/[roomId]/settings — sets archived_at so the room drops out of
// listUserRooms but the underlying data (stories/votes/history) is kept in
// case we ever want a "trash" view. Uses an action (not a DELETE endpoint)
// so the home page can submit it via a regular <form>.
export const actions: Actions = {
  archiveRoom: async ({ locals, platform, request }) => {
    const auth = locals.auth();
    if (!auth?.userId) throw error(401);
    if (!platform?.env?.DB) throw error(500, 'db unavailable');

    const data = await request.formData();
    const roomId = (data.get('roomId') as string)?.trim();
    if (!roomId) return fail(400, { error: 'roomId required' });

    const room = await getRoom(platform.env.DB, roomId);
    if (!room) throw error(404);
    if (room.host_user_id !== auth.userId) throw error(403, 'host only');

    await platform.env.DB.prepare('UPDATE rooms SET archived_at = ? WHERE id = ?')
      .bind(Date.now(), roomId)
      .run();
    return { ok: true };
  }
};
