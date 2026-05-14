import { expect, test } from 'vitest';
import { DECKS, isValidVote } from '$lib/server/decks';

test('fib deck has 10 values', () => expect(DECKS.fib.length).toBe(10));
test('rejects unknown value', () => expect(isValidVote('fib', '999')).toBe(false));
test('accepts known value', () => expect(isValidVote('tshirt', 'M')).toBe(true));
