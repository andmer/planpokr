import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Chip from '$lib/components/Chip.svelte';

test('shows initial + value', () => {
  render(Chip, { initial: 'A', value: '5' });
  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
});
