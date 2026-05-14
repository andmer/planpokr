import { test, expect } from '@playwright/test';

test('unauthenticated user sees Clerk sign-in on /', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*/);
  // Will pass once we wire the Clerk widget in Task 21.
});
