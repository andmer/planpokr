import { dark } from '@clerk/themes';

/**
 * Bare-bones Clerk appearance: dark base theme + green primary.
 * The bulk of the styling is done in src/lib/theme/clerk.css via the
 * `.cl-*` class selectors (the same pattern algocliff uses). That CSS
 * applies whether or not svelte-clerk forwards `appearance` correctly,
 * so it's the load-bearing source of truth.
 */
export const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#2dd35f',
    colorDanger: '#ef4444',
    borderRadius: '10px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontFamilyButtons: 'Inter, system-ui, sans-serif'
  }
};
