import type { PageServerLoad } from './$types';
import { listUserRooms } from '$lib/server/db';

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
