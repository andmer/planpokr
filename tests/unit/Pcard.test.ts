import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Pcard from '$lib/components/Pcard.svelte';

test('shows value', () => {
  render(Pcard, { value: '5' });
  expect(screen.getByText('5')).toBeInTheDocument();
});
test('selected adds sel class', () => {
  const { container } = render(Pcard, { value: '5', selected: true });
  expect(container.firstChild).toHaveClass('sel');
});
