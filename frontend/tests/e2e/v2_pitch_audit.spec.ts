import { test, expect } from '@playwright/test';

const ARTIFACTS_DIR = '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25';

test.describe('PingBin V2 Final Pitch UI & Live Demo Audit', () => {
  test('1. Command Center Dashboard & Live Priority Queue Audit', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });

    // Verify Title and Brand Header
    await expect(page.locator('text=PingBin')).toBeVisible();
    await expect(page.locator('text=PS-03 DISPATCH')).toBeVisible();
    await expect(page.locator('text=Live Priority Queue')).toBeVisible();

    // Verify Safety Gate filter & Suspicious badge
    await expect(page.locator('button:has-text("Safety Gate")')).toBeVisible();
    await page.waitForTimeout(1000);

    // Take screenshot of Command Center
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/v2_command_center.png`,
      fullPage: true,
    });
  });

  test('2. Safety Gate Modal & Admin Review Dossier Audit', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });

    // Filter to Safety Gate / find suspicious row and click it
    const safetyFilter = page.locator('button:has-text("Safety Gate")');
    if (await safetyFilter.isVisible()) {
      await safetyFilter.click();
      await page.waitForTimeout(500);
    }

    // Click on the first row in the queue table
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    await page.waitForTimeout(800);

    // Verify Incident Audit Modal is open
    await expect(page.locator('text=Municipal Logistics Dispatch Dossier')).toBeVisible();

    // Take screenshot of Safety Gate Audit Modal
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/v2_safety_gate_modal.png`,
      fullPage: true,
    });

    // Close Modal
    const closeBtn = page.locator('button:has-text("Close Dossier")');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('3. Recycling & Warehouses Logistics Audit', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });

    // Click on Recycling & Warehouses tab
    await page.click('button:has-text("Recycling & Warehouses")');

    // Verify KPI Banner
    await expect(page.locator('text=Estimated Recycling Revenue')).toBeVisible();
    await expect(page.locator('text=Total Recovered Weight')).toBeVisible();
    await expect(page.locator('text=Active MRF Facilities')).toBeVisible();
    await expect(page.locator('text=Recycling Logistics & Warehouse Shipments')).toBeVisible();
    await expect(page.locator('text=Registered Materials Recovery Facilities (MRF)')).toBeVisible();

    // Verify Bhubaneswar MRF Hubs
    await expect(page.locator('text=Patia MRF Depot')).toBeVisible();
    await expect(page.locator('text=Rasulgarh Metal Recovery')).toBeVisible();
    await expect(page.locator('text=Chandaka Organic & Paper')).toBeVisible();
    await expect(page.locator('text=Mancheswar Hazmat Unit')).toBeVisible();

    // Take screenshot of Recycling & Warehouses
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/v2_warehouses_recycling.png`,
      fullPage: true,
    });
  });

  test('4. Operations & Rewards Audit', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });

    // Click on Operations & Rewards tab
    await page.click('button:has-text("Operations & Rewards")');

    // Verify Operations UI
    await expect(page.locator('text=Operations & Citizen Rewards Orchestration')).toBeVisible();

    // Take screenshot of Operations
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/v2_operations_rewards.png`,
      fullPage: true,
    });
  });

  test('5. Live Demo WhatsApp Simulator Audit', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setViewportSize({ width: 1440, height: 900 });

    // Click on Live Demo tab
    await page.click('button:has-text("Live Demo")');

    // Verify WhatsApp Simulator
    await expect(page.locator('text=Real-Time WhatsApp Citizen & Worker Orchestrator')).toBeVisible();
    await expect(page.locator('text=CITIZEN APP')).toBeVisible();
    await expect(page.locator('text=WORKER DISPATCH')).toBeVisible();

    // Trigger simulation playback to test interaction
    const playBtn = page.locator('button:has-text("Start Live Demo")');
    if (await playBtn.isVisible()) {
      await playBtn.click();
      await page.waitForTimeout(3500);
    }

    // Take screenshot of Live Demo in action
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/v2_live_demo_simulator.png`,
      fullPage: true,
    });
  });
});
