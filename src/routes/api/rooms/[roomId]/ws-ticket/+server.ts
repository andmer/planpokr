import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { getRoom, isMember, ensureMember } from '$lib/server/db';
import { mintRoomToken } from '$lib/server/auth';

// Mint a short-lived HMAC token so the browser can open the DO WebSocket.
// Anyone signed in who has the URL becomes a member on first visit —
// the host invites by sharing the URL.
export const POST: RequestHandler = async ({ locals, platform, params }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw error(401);
  if (!platform?.env?.DB) throw error(500, 'db unavailable');

  const room = await getRoom(platform.env.DB, params.roomId);
  if (!room) throw error(404);

  if (!(await isMember(platform.env.DB, room.id, auth.userId))) {
    await ensureMember(platform.env.DB, room.id, auth.userId, 'member');
  }
  const role: 'host' | 'member' =
    room.host_user_id === auth.userId ? 'host' : 'member';

  const token = await mintRoomToken(
    platform.env.ROOM_TOKEN_SECRET,
    { userId: auth.userId, roomId: room.id, role },
    60
  );
  return json({ token });
};
