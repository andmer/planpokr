import type { Deck } from '$lib/types';

export const DECKS: Record<Deck, string[]> = {
  fib: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', '?', '☕']
};

export const isValidVote = (deck: Deck, value: string) => DECKS[deck].includes(value);
