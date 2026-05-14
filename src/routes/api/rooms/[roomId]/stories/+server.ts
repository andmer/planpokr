import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { getRoom, insertStory, listStories } from '$lib/server/db';

// Broadcast wrapper — the `RoomDO` is implemented in Phase 7. Until then the
// stub may not respond; swallow errors so HTTP mutations succeed regardless.
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
    // DO not yet wired up — fail silently.
  }
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
  const auth = locals.auth();
  if (!auth?.userId) throw error(401);
  if (!platform?.env?.DB) throw error(500, 'db unavailable');

  const room = await getRoom(platform.env.DB, params.roomId);
  if (!room) throw error(404);
  if (room.host_user_id !== auth.userId) throw error(403, 'host only');

  const body = (await request.json()) as { title?: string; description?: string };
  if (!body.title?.trim()) throw error(400, 'title required');

  const existing = await listStories(platform.env.DB, params.roomId);
  const position = (existing.results.at(-1)?.position ?? -1) + 1;

  const story = {
    id: crypto.randomUUID(),
    room_id: params.roomId,
    title: body.title.trim().slice(0, 200),
    description: body.description?.trim().slice(0, 2000) ?? null,
    position,
    status: 'pending' as const,
    final_estimate: null,
    final_round_id: null,
    created_at: Date.now()
  };
  await insertStory(platform.env.DB, story);

  await notifyDO(platform, params.roomId, { type: 'story_added', story });

  return json(story, { status: 201 });
};
