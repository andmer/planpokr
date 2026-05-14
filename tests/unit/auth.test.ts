import { expect, test } from 'vitest';
import { mintRoomToken, verifyRoomToken } from '$lib/server/auth';

const secret = 'test-secret-32-bytes-abcdefghij123';

test('round trip', async () => {
  const token = await mintRoomToken(secret, { userId: 'u1', roomId: 'r1', role: 'host' });
  const claims = await verifyRoomToken(secret, token);
  expect(claims).toMatchObject({ userId: 'u1', roomId: 'r1', role: 'host' });
});

test('rejects bad signature', async () => {
  const token = await mintRoomToken(secret, { userId: 'u1', roomId: 'r1', role: 'host' });
  await expect(verifyRoomToken('wrong-secret', token)).rejects.toThrow();
});

test('rejects expired', async () => {
  const token = await mintRoomToken(
    secret,
    { userId: 'u1', roomId: 'r1', role: 'host' },
    -10
  );
  await expect(verifyRoomToken(secret, token)).rejects.toThrow(/expired/);
});
