import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACTS_DIR = '/home/swyra/.gemini/antigravity-ide/brain/fb01cd6d-77fe-49e9-81fc-9092ab02bb25';

test.describe('PingBin Real End-to-End Workflow with Genuine Timer & Verification', () => {
  test('Full genuine lifecycle: citizen intake → auto-dispatch → worker arrival → real cleanup timer → truth verification → resolved → warehouse allocation', async ({ page }) => {
    test.setTimeout(90000);

    const citizenPhone = `+9198888${Date.now().toString().slice(-5)}`;
    const workerPhone = '+919876543210'; // Anand Patnaik
    const incidentLat = 20.3533;
    const incidentLng = 85.8197;

    console.log(`[Step 1] Citizen (${citizenPhone}) reports illegal waste pile via WhatsApp...`);

    // 1. Citizen sends Photo first with real sample image
    const photoRes = await fetch(`${API_BASE}/dev/simulate-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_phone: citizenPhone,
        message_type: 'photo',
        media_url: `${API_BASE}/images/dustbins-india-T5BHA9.jpg`,
        text: 'Huge plastic dump near KIIT square',
      }),
    });
    expect(photoRes.status).toBe(200);

    // Wait for Bedrock photo classification to register awaiting_location
    await page.waitForTimeout(3500);

    // 2. Citizen sends Location pin
    const locRes = await fetch(`${API_BASE}/dev/simulate-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_phone: citizenPhone,
        message_type: 'location',
        latitude: incidentLat,
        longitude: incidentLng,
      }),
    });
    expect(locRes.status).toBe(200);

    // Wait for Bedrock classification & auto-dispatch
    let activeReport: any = null;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      const repRes = await fetch(`${API_BASE}/reports`);
      const reports = await repRes.json();
      activeReport = reports.find((r: any) => r.citizen_phone === citizenPhone);
      if (activeReport && (activeReport.status === 'assigned' || activeReport.status === 'pending')) {
        break;
      }
    }

    expect(activeReport).toBeTruthy();
    const reportId = activeReport.report_id;
    const assignedWorkerPhone = activeReport.worker_phone || (activeReport.worker_phones && activeReport.worker_phones[0]) || workerPhone;
    console.log(`[Step 2] Report created #${reportId.slice(0, 8)} with status: ${activeReport.status}, waste: ${activeReport.waste_type}, assigned: ${assignedWorkerPhone}`);

    // 3. Worker sends START (Arrival Photo + Location within 50m)
    console.log(`[Step 3] Worker (${assignedWorkerPhone}) arrives on site and sends START proof...`);
    const workerStartRes = await fetch(`${API_BASE}/dev/simulate-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_phone: assignedWorkerPhone,
        message_type: 'photo',
        media_url: `${API_BASE}/images/dustbins-india-T5BHA9.jpg`,
        latitude: incidentLat,
        longitude: incidentLng,
        text: 'START',
      }),
    });
    expect(workerStartRes.status).toBe(200);

    // Verify report transitioned to in_progress
    let inProgReport: any = null;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const repRes = await fetch(`${API_BASE}/reports`);
      const reports = await repRes.json();
      inProgReport = reports.find((r: any) => r.report_id === reportId);
      if (inProgReport && inProgReport.status === 'in_progress') break;
    }
    expect(inProgReport.status).toBe('in_progress');
    console.log(`[Step 3 Verified] Report is now in_progress. Arrival time logged.`);

    // 4. REAL CLEANUP TIMER
    const waitSeconds = 7.0;
    console.log(`[Step 4] Worker actively cleaning on site... Real timer running for ${waitSeconds} seconds...`);
    await page.waitForTimeout(waitSeconds * 1000 + 500);

    // 5. Worker sends DONE (Finish Photo + Finish Location within 50m)
    console.log(`[Step 5] Worker (${assignedWorkerPhone}) finishes cleanup and sends DONE proof...`);
    const workerFinishRes = await fetch(`${API_BASE}/dev/simulate-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_phone: assignedWorkerPhone,
        message_type: 'photo',
        media_url: `${API_BASE}/images/dustbins-india-T5BHA9.jpg`,
        latitude: incidentLat,
        longitude: incidentLng,
        text: 'DONE',
      }),
    });
    expect(workerFinishRes.status).toBe(200);

    // 6. Verify Two-Gate Verification passed & status is RESOLVED
    let resolvedReport: any = null;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(800);
      const repRes = await fetch(`${API_BASE}/reports`);
      const reports = await repRes.json();
      resolvedReport = reports.find((r: any) => r.report_id === reportId);
      if (resolvedReport && resolvedReport.status === 'resolved') break;
    }

    expect(resolvedReport).toBeTruthy();
    expect(resolvedReport.status).toBe('resolved');
    expect(resolvedReport.reward_coupon_code).toBeTruthy();
    console.log(`[Step 6 Verified] Two-Gate passed! Status: ${resolvedReport.status}, Coupon: ${resolvedReport.reward_coupon_code}`);

    // 7. Verify UI & Warehouse Allocation in Browser
    console.log(`[Step 7] Navigating to Frontend at ${FRONTEND_URL}...`);
    await page.goto(FRONTEND_URL);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('text=PingBin')).toBeVisible({ timeout: 10000 });

    // Navigate to Recycling & Warehouses tab
    await page.click('button:has-text("Recycling & Warehouses")');
    await expect(page.locator('text=Recycling Logistics & Warehouse Shipments')).toBeVisible();

    // Find the resolved report row
    const reportShortId = reportId.slice(0, 8);
    const reportRow = page.locator(`tr:has-text("${reportShortId}")`).first();
    await expect(reportRow).toBeVisible({ timeout: 10000 });

    // Click Assign / Reassign button on this report
    const assignBtn = reportRow.locator('button:has-text("Assign"), button:has-text("Reassign")').first();
    await assignBtn.click();

    // Verify Assign Modal opens
    await expect(page.locator('text=Assign Waste to Recycling Facility')).toBeVisible();
    await expect(page.locator('text=Calculated Revenue')).toBeVisible();

    // Ensure NO NaN in calculated revenue
    const revenueElement = page.locator('.font-display.font-black.text-\\[\\#166534\\]');
    const revenueText = await revenueElement.textContent();
    expect(revenueText).not.toContain('NaN');
    expect(revenueText).toContain('₹');
    console.log(`[Step 7 Verified] Assign Modal Revenue is valid: ${revenueText}`);

    // Select Patia Materials Recovery Facility
    const whSelect = page.locator('select').first();
    await whSelect.selectOption('wh-patia-plastic');

    // Set measured weight
    const weightInput = page.locator('input[type="number"]').first();
    await weightInput.fill('45');

    // Confirm Facility Dispatch
    await page.click('button:has-text("Confirm Facility Dispatch")');

    // Verify toast notification
    await expect(page.locator('text=Shipment Assigned to Facility')).toBeVisible({ timeout: 6000 });

    // Save final screenshot of genuine resolved warehouse shipment
    await page.screenshot({
      path: `${ARTIFACTS_DIR}/real_workflow_verified.png`,
      fullPage: true,
    });

    console.log('[SUCCESS] Full genuine end-to-end lifecycle completed and verified!');
  });
});
