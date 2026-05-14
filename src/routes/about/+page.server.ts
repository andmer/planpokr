import type { PageServerLoad } from './$types';

// Public — same content for signed-in and signed-out visitors. The page just
// needs to know whether to render the auth-aware topbar (Rooms tab + user
// button) vs. the signed-out shell (Sign in / Sign up CTAs).
export const load: PageServerLoad = async ({ locals }) => {
  const auth = locals.auth();
  return { signedIn: !!auth?.userId };
};
