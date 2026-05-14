// Room-scoped HMAC-SHA256 JWT minted by the Worker and verified by the DO.
// Self-contained — no extra DB hit per WebSocket connect.

const enc = new TextEncoder();

const b64 = (b: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const ub64 = (s: string): Uint8Array =>
  Uint8Array.from(
    atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)),
    (c) => c.charCodeAt(0)
  );

const hmacKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

export type RoomClaims = { userId: string; roomId: string; role: 'host' | 'member' };

export const mintRoomToken = async (
  secret: string,
  claims: RoomClaims,
  ttlSec = 60
): Promise<string> => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const head = b64(enc.encode(JSON.stringify(header)));
  const body = b64(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    enc.encode(`${head}.${body}`)
  );
  return `${head}.${body}.${b64(sig)}`;
};

export const verifyRoomToken = async (
  secret: string,
  token: string
): Promise<RoomClaims> => {
  const [head, body, sig] = token.split('.');
  if (!head || !body || !sig) throw new Error('malformed');
  const ok = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    ub64(sig),
    enc.encode(`${head}.${body}`)
  );
  if (!ok) throw new Error('bad signature');
  const payload = JSON.parse(new TextDecoder().decode(ub64(body)));
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('expired');
  }
  return { userId: payload.userId, roomId: payload.roomId, role: payload.role };
};
