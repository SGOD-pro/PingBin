import { test, expect } from '@playwright/test';

test('Capture full UI screenshots with real images and modals', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 1. Screenshot Dashboard Command Center
  await page.screenshot({ path: 'test-results/dashboard-command-center.png', fullPage: true });

  // 2. Open Needs Review Queue item
  const inspectBtn = page.locator('text=Inspect Dossier').first();
  if (await inspectBtn.isVisible()) {
    await inspectBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/incident-dossier-modal.png' });
    
    // Close modal via button
    const closeBtn = page.locator('text=Close Dossier').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  }

  // 3. Open Staff / Workers modal
  const staffBtn = page.getByRole('button', { name: /staff/i }).first();
  await staffBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/staff-roster-modal.png' });
});
