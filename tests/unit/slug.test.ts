import { expect, test } from 'vitest';
import { generateSlug } from '$lib/server/slug';

test('produces "adjective-noun-NN" format', () => {
  const s = generateSlug();
  expect(s).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
});

test('uniqueness across 100 calls (not strictly guaranteed but pragmatically so)', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) seen.add(generateSlug());
  expect(seen.size).toBeGreaterThan(80);
});
