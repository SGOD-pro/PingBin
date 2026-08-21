import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  // Checking that it loads without error and has basic React structure.
  await expect(page).toHaveTitle(/PingBin/);
});

test('shows dashboard title', async ({ page }) => {
  await page.goto('/');
  // Check if main dashboard header exists
  const heading = page.locator('h1, h2, [role="heading"]').first();
  await expect(heading).toBeVisible();
});
