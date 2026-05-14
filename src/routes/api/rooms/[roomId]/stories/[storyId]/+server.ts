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

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw error(401);
  if (!platform?.env?.DB) throw error(500, 'db unavailable');

  const room = await getRoom(platform.env.DB, params.roomId);
  if (!room) throw error(404);
  if (room.host_user_id !== auth.userId) throw error(403);

  const body = (await request.json()) as { title?: string; description?: string };
  const sets: string[] = [];
  const args: (string | null)[] = [];
  if (body.title !== undefined) {
    sets.push('title = ?');
    args.push(body.title.slice(0, 200));
  }
  if (body.description !== undefined) {
    sets.push('description = ?');
    args.push(body.description.slice(0, 2000));
  }
  if (!sets.length) throw error(400, 'no updatable fields');
  args.push(params.storyId, params.roomId);
  await platform.env.DB.prepare(
    `UPDATE stories SET ${sets.join(', ')} WHERE id = ? AND room_id = ?`
  )
    .bind(...args)
    .run();

  await notifyDO(platform, params.roomId, {
    type: 'story_updated',
    storyId: params.storyId,
    ...body
  });

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw error(401);
  if (!platform?.env?.DB) throw error(500, 'db unavailable');

  const room = await getRoom(platform.env.DB, params.roomId);
  if (!room) throw error(404);
  if (room.host_user_id !== auth.userId) throw error(403);

  await platform.env.DB.prepare('DELETE FROM stories WHERE id = ? AND room_id = ?')
    .bind(params.storyId, params.roomId)
    .run();

  await notifyDO(platform, params.roomId, {
    type: 'story_removed',
    storyId: params.storyId
  });

  return json({ ok: true });
};
