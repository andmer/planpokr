import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Verdict from '$lib/components/Verdict.svelte';

test.each([
  ['consensus', 'CONSENSUS'],
  ['no-consensus', 'NO CONSENSUS'],
  ['skipped', 'SKIPPED']
])('renders %s', (kind, label) => {
  render(Verdict, { kind: kind as any });
  expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
});
