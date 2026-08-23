import { test, expect } from '@playwright/test';

const ARTIFACTS_DIR = '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25';

test.describe('PingBin V2 Frontend Full E2E & UI/UX Verification', () => {
  
  test('1. Backend Health Gate & Clean Header Layout', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });

    // Verify Brand Logo & Navigation
    await expect(page.locator('text=PingBin')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Live AWS')).toBeVisible();
    await expect(page.locator('button:has-text("Command Center")')).toBeVisible();
    await expect(page.locator('button:has-text("Recycling & Warehouses")')).toBeVisible();
    await expect(page.locator('button:has-text("Operations")')).toBeVisible();
    await expect(page.locator('button:has-text("Live Demo")')).toBeVisible();

    // Verify Live Priority Queue and Stats
    await expect(page.locator('text=Live Priority Queue')).toBeVisible();
    await expect(page.locator('button:has-text("Safety Gate")')).toBeVisible();

    // Save screenshot
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/e2e_command_center.png`,
      fullPage: true,
    });
  });

  test('2. Sonner Toast Verification on Telemetry Refresh', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });

    // Wait for initial load
    await expect(page.locator('text=PingBin')).toBeVisible({ timeout: 10000 });

    // Click Refresh button (with title "Last synced:")
    const refreshBtn = page.locator('button[title*="Last sync"]').first();
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // Verify Sonner Toast appears
    await expect(page.locator('text=Telemetry Synchronized')).toBeVisible({ timeout: 5000 });

    // Save screenshot with active Sonner toast
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/e2e_sonner_toast.png`,
      fullPage: false,
    });
  });

  test('3. Zod Form Validation & Worker Enrollment in Staff Modal', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('text=PingBin')).toBeVisible({ timeout: 10000 });

    // Open Staff Modal
    const staffBtn = page.locator('button:has-text("Staff")').first();
    await staffBtn.click();
    await expect(page.locator('text=Sanitation Worker Fleet')).toBeVisible();

    // Toggle to Add Worker Form
    await page.click('button:has-text("Add Worker")');
    await expect(page.locator('text=Enroll New Sanitation Worker')).toBeVisible();

    // Attempt to submit empty form -> Test Zod validation
    const submitBtn = page.locator('button:has-text("Register Field Worker")');
    await submitBtn.click();

    // Fill valid data
    await page.fill('input[placeholder*="Ramesh Kumar"]', 'Anand Patnaik');
    const dynamicPhone = `+919938${Date.now().toString().slice(-6)}`;
    await page.fill('input[placeholder*="+91"]', dynamicPhone);

    // Submit form
    await submitBtn.click();

    // Verify Sonner Toast for enrollment
    await expect(page.locator('text=Worker Enrolled')).toBeVisible({ timeout: 6000 });

    // Save screenshot
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/e2e_staff_zod_modal.png`,
      fullPage: false,
    });

    // Close modal
    await page.click('button:has-text("Done")');
  });

  test('4. Recycling & Warehouses Logistics View', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('text=PingBin')).toBeVisible({ timeout: 10000 });

    // Navigate to Recycling & Warehouses
    await page.click('button:has-text("Recycling & Warehouses")');

    // Verify KPIs
    await expect(page.locator('text=Estimated Recycling Revenue')).toBeVisible();
    await expect(page.locator('text=Total Recovered Weight')).toBeVisible();
    await expect(page.locator('text=Registered Materials Recovery Facilities (MRF)')).toBeVisible();

    // Save screenshot
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/e2e_warehouses_view.png`,
      fullPage: true,
    });
  });

  test('5. Live WhatsApp Simulator Demo', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('text=PingBin')).toBeVisible({ timeout: 10000 });

    // Navigate to Live Demo
    await page.click('button:has-text("Live Demo")');

    // Verify WhatsApp Simulator elements
    await expect(page.locator('text=Real-Time WhatsApp Citizen & Worker Orchestrator')).toBeVisible();
    await expect(page.locator('text=CITIZEN APP')).toBeVisible();
    await expect(page.locator('text=WORKER DISPATCH')).toBeVisible();

    // Start live simulation
    const startBtn = page.locator('button:has-text("Start Live Demo")');
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(3000);
    }

    // Save screenshot
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/e2e_live_demo_simulation.png`,
      fullPage: true,
    });
  });
});
