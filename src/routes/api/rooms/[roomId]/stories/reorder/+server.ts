import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { getRoom } from '$lib/server/db';

// Broadcast wrapper — `RoomDO` lands in Phase 7. Until then, swallow errors so
// HTTP mutations succeed regardless of DO availability.
const notifyDO = async (
  platform: App.Platform | undefined,
  roomId: string,
  payload: unknown
): Promise<void> => {
  try {
    const ns = platform?.env?.ROOM;
    if (!ns) return;
    const stub = ns.get(ns.idFromName(roomId));
    await stub.fetch('http://do/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  } catch {
    /* not yet wired */
  }
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw error(401);
  if (!platform?.env?.DB) throw error(500, 'db unavailable');

  const room = await getRoom(platform.env.DB, params.roomId);
  if (!room) throw error(404);
  if (room.host_user_id !== auth.userId) throw error(403);

  const body = (await request.json()) as { storyIds?: string[] };
  if (!Array.isArray(body.storyIds)) throw error(400, 'storyIds required');

  const db = platform.env.DB;
  await db.batch(
    body.storyIds.map((id, i) =>
      db
        .prepare('UPDATE stories SET position = ? WHERE id = ? AND room_id = ?')
        .bind(i, id, params.roomId)
    )
  );

  await notifyDO(platform, params.roomId, {
    type: 'story_reordered',
    storyIds: body.storyIds
  });

  return json({ ok: true });
};
