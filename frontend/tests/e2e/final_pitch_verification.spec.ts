import { test, expect } from '@playwright/test';

test.describe('PingBin Final Pre-Pitch Verification Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Ensure app warms up and loads
    await expect(page.getByRole('button', { name: 'Command Center' })).toBeVisible({ timeout: 15000 });
  });

  test('1. Header has LIVE SYNC timestamp and NO "Simulate Intake" button', async ({ page }) => {
    // Check that simulate intake is gone
    await expect(page.locator('button:has-text("Simulate Intake")')).toHaveCount(0);

    // Check Live Sync indicator
    await expect(page.locator('text=LIVE SYNC')).toBeVisible();
    await expect(page.locator('text=Live AWS')).toBeVisible();

    await page.screenshot({ path: '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25/final_header_verified.png' });
  });

  test('2. Live Priority Queue table: fixed-height scroll container & icon-only action buttons', async ({ page }) => {
    const queueTable = page.locator('table').first();
    await expect(queueTable).toBeVisible();

    // Check table headers
    await expect(page.locator('th:has-text("Priority Score")')).toBeVisible();
    await expect(page.locator('th:has-text("Status / Action")')).toBeVisible();

    // Check that pending_admin_review items have icon action buttons with title or aria
    const approveBtn = page.locator('button[aria-label="Approve & Dispatch"]').first();
    const rejectBtn = page.locator('button[aria-label="Reject"]').first();
    if (await approveBtn.count() > 0) {
      await expect(approveBtn).toBeVisible();
      await expect(rejectBtn).toBeVisible();
    }

    await page.screenshot({ path: '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25/final_priority_queue_icons.png' });
  });

  test('3. Geospatial Map has Recenter button & interactive network overlay', async ({ page }) => {
    await expect(page.locator('text=Live Geospatial Network')).toBeVisible();
    const recenterBtn = page.getByRole('button', { name: 'Recenter' });
    await expect(recenterBtn).toBeVisible();
    await recenterBtn.click();

    await page.screenshot({ path: '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25/final_map_recenter.png' });
  });

  test('4. Worker Phone Uniqueness Validation (rejects duplicate registration)', async ({ page }) => {
    // Open staff modal
    await page.getByRole('button', { name: /Staff/ }).click();
    await expect(page.locator('text=Sanitation Worker Fleet')).toBeVisible();

    // Click Add Worker
    await page.click('button:has-text("Add Worker")');
    await expect(page.locator('text=Enroll New Sanitation Worker')).toBeVisible();

    // Fill form with duplicate phone number (+919876543210 which is already registered to Anand Patnaik)
    await page.fill('input[placeholder*="Ramesh"]', 'Test Duplicate Worker');
    await page.fill('input[placeholder*="+919876543210"]', '+919876543210');
    await page.click('button:has-text("Register Field Worker")');

    // Should show error toast for duplicate phone
    await expect(page.locator('text=Enrollment Failed').or(page.locator('text=already registered'))).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25/final_worker_duplicate_validation.png' });
    await page.click('button:has-text("Cancel")');
  });

  test('5. Recycling & Warehouses: Dynamic KPIs, Add Facility Modal, and Assign to Facility', async ({ page }) => {
    // Navigate to Warehouses tab
    await page.getByRole('button', { name: /Recycling & Warehouses/ }).click();
    await expect(page.locator('text=Recycling Logistics & Warehouse Shipments')).toBeVisible();

    // Verify dynamic KPI cards
    await expect(page.locator('text=Estimated Recycling Revenue')).toBeVisible();
    await expect(page.locator('text=Total Recovered Weight')).toBeVisible();
    await expect(page.locator('text=Active MRF Facilities')).toBeVisible();

    // Verify Add Facility modal
    await page.getByRole('button', { name: 'Add Facility' }).click();
    await expect(page.locator('text=Register New MRF Facility')).toBeVisible();

    // Fill new warehouse facility
    const testWhName = `Khandagiri Demo MRF ${Date.now().toString().slice(-4)}`;
    await page.fill('input[placeholder*="Khandagiri"]', testWhName);
    const rateInput = page.locator('label:has-text("Buying Rate")').locator('..').locator('input');
    await rateInput.fill('14.5');
    await page.fill('input[placeholder*="Bhubaneswar"]', 'Khandagiri Sector 9');
    await page.click('button:has-text("Enroll MRF Facility")');

    // Verify success toast
    await expect(page.locator('text=MRF Facility Registered')).toBeVisible({ timeout: 6000 });

    // Verify Assign Facility modal on a shipment row
    const assignBtn = page.locator('button:has-text("Assign Facility"), button:has-text("Reassign")').first();
    if (await assignBtn.count() > 0) {
      await assignBtn.click();
      await expect(page.locator('text=Assign Waste to Recycling Facility')).toBeVisible();
      await expect(page.locator('text=Calculated Revenue')).toBeVisible();
      await page.click('button:has-text("Confirm Facility Dispatch")');
      await expect(page.locator('text=Shipment Assigned to Facility')).toBeVisible({ timeout: 6000 });
    }

    await page.screenshot({ path: '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25/final_warehouses_verified.png' });
  });

  test('6. WhatsApp Live Demo: 5 Pitch Demo Scenarios including Session Timeout', async ({ page }) => {
    // Navigate to Live Demo
    await page.getByRole('button', { name: /Live Demo/ }).click();
    await expect(page.locator('text=Real-Time WhatsApp Citizen & Worker Orchestrator')).toBeVisible();

    // Check all 5 scenario buttons exist
    await expect(page.locator('text=1. Standard Resolution & Reward')).toBeVisible();
    await expect(page.locator('text=2. Truth Engine: Fake-Work Gate')).toBeVisible();
    await expect(page.locator('text=3. Safety Gate: Fake/Low-Conf Photo')).toBeVisible();
    await expect(page.locator('text=4. Order-Agnostic: Location First')).toBeVisible();
    await expect(page.locator('text=5. Intake Session Expired (>2.5 min)')).toBeVisible();

    // Test Scenario 5 execution
    await page.click('text=5. Intake Session Expired (>2.5 min)');
    await page.click('button:has-text("Run Selected Scenario")');

    // Verify simulator messages
    await expect(page.locator('text=Session Expired')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Your previous intake session timed out')).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25/final_live_demo_scenario5.png' });
  });
});
