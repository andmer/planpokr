// Card deck definitions. Lives outside `$lib/server` so the browser can
// import the card values for the voting UI; `isValidVote` is used by the
// server (and is safe on the client too).

import type { Deck } from '$lib/types';

export const DECKS: Record<Deck, string[]> = {
  fib: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', '?', '☕']
};

export const isValidVote = (deck: Deck, value: string) => DECKS[deck].includes(value);
