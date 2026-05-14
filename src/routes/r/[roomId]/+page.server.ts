import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getRoom, ensureMember } from '$lib/server/db';

// Ensures the requesting user is signed in and a member of the room before
// the WebSocket handshake. Full live state is delivered via WS; we don't
// hydrate stories/presence on the server.
export const load: PageServerLoad = async ({ locals, platform, params }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw redirect(302, '/');
  if (!platform?.env?.DB) throw error(500, 'db unavailable');

  const room = await getRoom(platform.env.DB, params.roomId);
  if (!room) throw error(404);

  await ensureMember(
    platform.env.DB,
    room.id,
    auth.userId,
    room.host_user_id === auth.userId ? 'host' : 'member'
  );

  return { roomId: params.roomId };
};
