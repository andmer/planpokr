import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Avatar from '$lib/components/Avatar.svelte';

test('shows initial', () => {
  render(Avatar, { initial: 'A' });
  expect(screen.getByText('A')).toBeInTheDocument();
});
test('host role adds host class', () => {
  const { container } = render(Avatar, { initial: 'A', role: 'host' });
  expect(container.firstChild).toHaveClass('host');
});
