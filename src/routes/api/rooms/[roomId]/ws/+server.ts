import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

// Upgrade forwarder — turns an HTTP WebSocket-upgrade request into a
// `fetch` call on the room's Durable Object stub. The DO's `/ws` handler
// verifies the room token and accepts the socket via the hibernation API.
export const GET: RequestHandler = async ({ platform, params, url, request }) => {
  if (!platform?.env?.ROOM) throw error(500, 'do unavailable');
  if (request.headers.get('upgrade') !== 'websocket') {
    throw error(426, 'expected websocket upgrade');
  }

  const id = platform.env.ROOM.idFromName(params.roomId);
  const stub = platform.env.ROOM.get(id);

  const fwd = new URL('http://do/ws');
  fwd.searchParams.set('t', url.searchParams.get('t') ?? '');

  return stub.fetch(fwd.toString(), {
    headers: { upgrade: 'websocket' }
  });
};
