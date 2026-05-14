import { expect, test } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('http://localhost:4173/');
});
