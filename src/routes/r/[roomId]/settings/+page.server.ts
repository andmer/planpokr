import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { getRoom } from '$lib/server/db';
import type { MemberRole } from '$lib/types';

type MemberRow = {
  room_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: number;
  display_name: string;
};

// Host-only settings page. Renames the room, switches deck, archives, or
// permanently deletes it. Non-hosts get a 403.
export const load: PageServerLoad = async ({ locals, platform, params }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw redirect(302, '/');
  if (!platform?.env?.DB) throw error(500, 'db unavailable');

  const room = await getRoom(platform.env.DB, params.roomId);
  if (!room) throw error(404);
  if (room.host_user_id !== auth.userId) throw error(403, 'host only');

  const members = (
    await platform.env.DB.prepare(
      `SELECT rm.*, u.display_name FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = ?
       ORDER BY rm.joined_at`
    )
      .bind(room.id)
      .all<MemberRow>()
  ).results;

  return { room, members };
};

// All actions re-check host ownership server-side; never trust the client.
export const actions: Actions = {
  rename: async ({ locals, platform, params, request }) => {
    const auth = locals.auth();
    if (!auth?.userId) throw error(401);
    if (!platform?.env?.DB) throw error(500);
    const room = await getRoom(platform.env.DB, params.roomId);
    if (!room) throw error(404);
    if (room.host_user_id !== auth.userId) throw error(403);

    const data = await request.formData();
    const name = ((data.get('name') as string) ?? '').trim().slice(0, 80);
    if (!name) return fail(400, { error: 'name required' });
    await platform.env.DB.prepare(
      'UPDATE rooms SET name = ? WHERE id = ?'
    )
      .bind(name, params.roomId)
      .run();
    return { ok: true };
  },

  setDeck: async ({ locals, platform, params, request }) => {
    const auth = locals.auth();
    if (!auth?.userId) throw error(401);
    if (!platform?.env?.DB) throw error(500);
    const room = await getRoom(platform.env.DB, params.roomId);
    if (!room) throw error(404);
    if (room.host_user_id !== auth.userId) throw error(403);

    const data = await request.formData();
    const deck = data.get('deck') as string;
    if (!['fib', 'tshirt'].includes(deck)) return fail(400);
    await platform.env.DB.prepare(
      'UPDATE rooms SET deck = ? WHERE id = ?'
    )
      .bind(deck, params.roomId)
      .run();
    return { ok: true };
  },

  archive: async ({ locals, platform, params }) => {
    const auth = locals.auth();
    if (!auth?.userId) throw error(401);
    if (!platform?.env?.DB) throw error(500);
    const room = await getRoom(platform.env.DB, params.roomId);
    if (!room) throw error(404);
    if (room.host_user_id !== auth.userId) throw error(403);

    await platform.env.DB.prepare(
      'UPDATE rooms SET archived_at = ? WHERE id = ?'
    )
      .bind(Date.now(), params.roomId)
      .run();
    throw redirect(303, '/');
  },

  remove: async ({ locals, platform, params }) => {
    const auth = locals.auth();
    if (!auth?.userId) throw error(401);
    if (!platform?.env?.DB) throw error(500);
    const room = await getRoom(platform.env.DB, params.roomId);
    if (!room) throw error(404);
    if (room.host_user_id !== auth.userId) throw error(403);

    await platform.env.DB.prepare('DELETE FROM rooms WHERE id = ?')
      .bind(params.roomId)
      .run();
    throw redirect(303, '/');
  }
};
