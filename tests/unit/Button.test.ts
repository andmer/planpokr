import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { expect, test } from 'vitest';
import Button from '$lib/components/Button.svelte';

const textSnippet = (text: string) =>
  createRawSnippet(() => ({
    render: () => `<span>${text}</span>`
  }));

test('renders primary by default', () => {
  render(Button, { children: textSnippet('Reveal') });
  expect(screen.getByRole('button')).toHaveTextContent('Reveal');
});

test('applies variant class', () => {
  render(Button, { variant: 'ghost', children: textSnippet('Skip') });
  expect(screen.getByRole('button').className).toMatch(/ghost/);
});
