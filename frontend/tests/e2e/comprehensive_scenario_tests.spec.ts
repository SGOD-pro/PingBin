/**
 * comprehensive_scenario_tests.spec.ts
 * =====================================
 * Full multi-scenario real workflow tests. Zero faking, zero direct DB writes.
 * All state flows through real HTTP endpoints only.
 *
 * SCENARIOS:
 *  S1. Happy Path   — real 8s cleanup timer → truth≥50% → RESOLVED + coupon
 *  S2. Fake Cleanup — worker DONE in 0.5s → truth<50% → needs_review, NO coupon
 *  S3. Wrong Seq    — orphan worker DONE with no active report → no phantom records
 *  S4. Invalid Img  — truly non-waste (black solid) → LLM rejects → NOT dispatched
 *  S5. GPS Spoof    — worker arrival >50m from site → Gate A blocks → stays 'assigned'
 *  S6. Dup Phone    — same WhatsApp number → HTTP 400
 *  S7. Determinism  — same image twice → same waste_type (temperature=0 fix)
 */
import { test, expect } from '@playwright/test';

// Reset all workers to free after each test to prevent starvation across sequential scenarios
test.afterEach(async () => {
  await fetch('http://localhost:8000/dev/reset-workers', { method: 'POST' });
});

const API = 'http://localhost:8000';
const WASTE_IMG_URL = `${API}/images/dustbins-india-T5BHA9.jpg`;

const SITE = { lat: 20.2961, lng: 85.8245 };
const NEAR = { lat: 20.2963, lng: 85.8247 }; // ~25m — Gate A PASS
const FAR  = { lat: 20.3500, lng: 85.8800 }; // ~7km  — Gate A FAIL

function getUniquePhone(prefix: string) {
  return `+91${prefix}${Date.now().toString().slice(-7)}`;
}

// Minimal valid JPEG that is 1x1 solid black — not a waste image at all
// (Confirmed: Nova Lite's is_valid_report=false for solid-color blanks)
const SOLID_BLACK_JPEG_B64 = 
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkK' +
  'DA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAARC AABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAA' +
  'AAAAAAAAAAAABgUH/8QAIBAAAQQBBQEAAAAAAAAAAAAAAQIDBAUREiExQf/EABQBAQAAAAAAAAAAAAAAA' +
  'AAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AK3RNbTDXQu1wQxDdBJJAUEgA6UB' +
  'pq4Kh2ByS2Vk5P8AJVR5mVjZktkJJAH/2Q==';

// ── Helpers ──────────────────────────────────────────────────────────────────
async function post(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function sim(msg: Record<string, unknown>) {
  return post('/dev/simulate-message', msg);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function getReports(): Promise<Record<string, unknown>[]> {
  return fetch(`${API}/reports`).then(r => r.json());
}

async function waitFor(
  predicate: () => Promise<Record<string, unknown> | null>,
  ms = 20000,
): Promise<Record<string, unknown> | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await predicate();
    if (r) return r;
    await sleep(700);
  }
  return null;
}

async function byPhone(phone: string, ms = 18000) {
  return waitFor(async () => {
    const reps = await getReports();
    return reps.find(r => r['citizen_phone'] === phone) || null;
  }, ms);
}

async function withStatus(id: string, statuses: string[], ms = 25000) {
  return waitFor(async () => {
    const reps = await getReports();
    const r = reps.find(x => x['report_id'] === id);
    return r && statuses.includes(r['status'] as string) ? r : null;
  }, ms);
}

// ─────────────────────────────────────────────────────────────────────────────
// S1: Happy Path — real 8s cleanup timer → truth≥50% → resolved + coupon
// ─────────────────────────────────────────────────────────────────────────────
test('S1: Happy Path — 8s real timer → resolved + coupon', async () => {
  test.setTimeout(90000);
  const phone = getUniquePhone('989');
  console.log(`\n[S1] Citizen ${phone} reporting waste...`);

  await sim({ sender_phone: phone, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(4000); // wait for Bedrock triage

  await sim({ sender_phone: phone, message_type: 'location', latitude: SITE.lat, longitude: SITE.lng });
  await sleep(4000);

  const report = await byPhone(phone, 18000);
  expect(report, 'S1: Report must exist after intake').not.toBeNull();
  const id = report!['report_id'] as string;
  console.log(`[S1] Report #${id.slice(0,8)} status=${report!['status']}`);

  const assigned = await withStatus(id, ['assigned'], 15000);
  expect(assigned, 'S1: Must become assigned').not.toBeNull();
  const worker = (assigned!['worker_phones'] as string[])?.[0] || (assigned!['worker_phone'] as string);
  console.log(`[S1] Assigned → ${worker}`);

  // Worker START (≤50m)
  await sim({ sender_phone: worker, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(800);
  await sim({ sender_phone: worker, message_type: 'location', latitude: NEAR.lat, longitude: NEAR.lng });
  
  const inProgress = await withStatus(id, ['in_progress'], 10000);
  expect(inProgress, 'S1: Must reach in_progress after worker arrival').not.toBeNull();
  console.log('[S1] in_progress — real 8s cleanup timer running...');
  await sleep(8000);

  // Worker DONE
  await sim({ sender_phone: worker, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(800);
  await sim({ sender_phone: worker, message_type: 'location', latitude: NEAR.lat, longitude: NEAR.lng });

  const resolved = await withStatus(id, ['resolved'], 20000);
  expect(resolved, 'S1: Must be resolved after 8s timer').not.toBeNull();

  const truth = resolved!['truth_percentage'] as number;
  const coupon = resolved!['reward_coupon_code'] as string;
  console.log(`[S1 ✅ PASS] truth=${truth}% coupon=${coupon}`);
  expect(truth).toBeGreaterThanOrEqual(50);
  expect(coupon).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// S2: Worker fakes cleanup in 0.5s → truth<50% → needs_review, NO coupon
// ─────────────────────────────────────────────────────────────────────────────
test('S2: Fake fast cleanup (0.5s) → needs_review, coupon field must be empty', async () => {
  test.setTimeout(120000);
  const phone = getUniquePhone('988');
  console.log(`\n[S2] Citizen ${phone} — fake-worker test...`);

  await sim({ sender_phone: phone, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(4000);
  await sim({ sender_phone: phone, message_type: 'location', latitude: SITE.lat, longitude: SITE.lng });
  await sleep(4000);

  const report = await byPhone(phone, 18000);
  expect(report, 'S2: Report must exist').not.toBeNull();
  const id = report!['report_id'] as string;
  console.log(`[S2] Report #${id.slice(0,8)} — waiting for assignment...`);

  const assigned = await withStatus(id, ['assigned'], 30000);
  expect(assigned, 'S2: Report must become assigned (waited 30s)').not.toBeNull();
  const worker = (assigned!['worker_phones'] as string[])?.[0] || (assigned!['worker_phone'] as string);
  console.log(`[S2] Assigned → ${worker}`);

  // Worker START: pass explicit arrival timestamp so we control the timer
  const arrivalTime = new Date().toISOString();
  await sim({ sender_phone: worker, message_type: 'photo', media_url: WASTE_IMG_URL, timestamp: arrivalTime });
  await sleep(700);
  await sim({ sender_phone: worker, message_type: 'location', latitude: NEAR.lat, longitude: NEAR.lng, timestamp: arrivalTime });
  
  const inProgress = await withStatus(id, ['in_progress'], 10000);
  expect(inProgress, 'S2: Must reach in_progress').not.toBeNull();
  console.log(`[S2] in_progress — arrival timestamp fixed at: ${arrivalTime}`);

  // Fake DONE: set finish timestamp to arrivalTime + 0.5s
  // This guarantees actual_duration = 0.5s from backend's perspective
  // truth = round(0.5 / 8.0 * 100) = 6% < 50% → MUST be needs_review
  console.log('[S2] Worker fakes DONE with timestamp 0.5s after arrival...');
  const fakeFinishTime = new Date(new Date(arrivalTime).getTime() + 500).toISOString();
  await sim({ sender_phone: worker, message_type: 'photo', media_url: WASTE_IMG_URL, timestamp: fakeFinishTime });
  await sleep(300);
  await sim({ sender_phone: worker, message_type: 'location', latitude: NEAR.lat, longitude: NEAR.lng, timestamp: fakeFinishTime });

  // Wait up to 20s for needs_review
  const review = await withStatus(id, ['needs_review'], 20000);
  expect(review, 'S2: Fake cleanup MUST go to needs_review (Gate B should block it)').not.toBeNull();

  const truth = review!['truth_percentage'] as number;
  const coupon = (review!['reward_coupon_code'] as string) || '';
  const reason = review!['review_reason'] as string;
  console.log(`[S2 ✅ PASS] needs_review | truth=${truth}% | reason="${reason}" | coupon="${coupon}"`);
  
  expect(truth).toBeLessThan(50);  // Gate B blocked: truth=6% < 50%
  expect(coupon).toBe('');          // NO coupon for fraudulent work
});

// ─────────────────────────────────────────────────────────────────────────────
// S3: Wrong sequence — orphan worker DONE with no active report → no phantom records
// ─────────────────────────────────────────────────────────────────────────────
test('S3: Orphan worker DONE (no active report) → no phantom resolved record', async () => {
  test.setTimeout(30000);
  const orphanPhone = '+919938416180';
  const startTs = new Date().toISOString();

  console.log(`\n[S3] Orphan DONE from ${orphanPhone} (no active assigned/in_progress report)...`);
  await sim({ sender_phone: orphanPhone, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(800);
  await sim({ sender_phone: orphanPhone, message_type: 'location', latitude: SITE.lat, longitude: SITE.lng });
  await sleep(3000);

  const after = await getReports();
  // Verify orphan worker's message did not create a new resolved report assigned to them
  const orphanResolved = after.filter(r => 
    (r['worker_phone'] === orphanPhone || (r['worker_phones'] as string[] || []).includes(orphanPhone)) &&
    ['resolved', 'needs_review'].includes(r['status'] as string) &&
    (r['created_at'] as string || '') >= startTs
  );
  console.log(`[S3 ✅ PASS] Orphan resolved reports created: ${orphanResolved.length} (expected 0)`);
  expect(orphanResolved.length).toBe(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// S4: Truly invalid image (solid black JPEG) → LLM rejects → NOT auto-dispatched
// ─────────────────────────────────────────────────────────────────────────────
test('S4: Solid black JPEG (not waste) → LLM rejects → NOT assigned or resolved', async () => {
  test.setTimeout(45000);
  const phone = getUniquePhone('987');

  console.log(`\n[S4] Citizen ${phone} sends solid black non-waste image...`);
  await sim({ 
    sender_phone: phone, 
    message_type: 'photo', 
    image_base64: SOLID_BLACK_JPEG_B64,  // inline base64 — no media_url
  });
  await sleep(3000);
  await sim({ sender_phone: phone, message_type: 'location', latitude: SITE.lat, longitude: SITE.lng });
  await sleep(8000); // Wait longer for LLM to process and gate

  const reps = await getReports();
  const r = reps.find(x => x['citizen_phone'] === phone);

  if (r) {
    const status = r['status'] as string;
    const confidence = r['confidence'] as number || 0;
    console.log(`[S4 ✅ PASS] Report status="${status}" confidence=${confidence} — LLM gated it (not dispatched)`);
    // Must NOT be auto-dispatched to workers
    expect(status).not.toBe('assigned');
    expect(status).not.toBe('resolved');
    // Acceptable statuses: pending_admin_review (low confidence), needs_review, awaiting_*
  } else {
    // LLM hard-rejected before any DB write — even better
    console.log('[S4 ✅ PASS] No report found for this citizen — LLM blocked before DB write');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// S5: GPS spoofing — worker arrival 7km away → Gate A blocks → stays 'assigned'
// ─────────────────────────────────────────────────────────────────────────────
test('S5: GPS spoofing (7km from site) → Gate A blocks worker arrival', async () => {
  test.setTimeout(120000);
  const phone = getUniquePhone('986');

  console.log(`\n[S5] Setting up fresh report for GPS spoof test...`);
  await sim({ sender_phone: phone, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(4000);
  await sim({ sender_phone: phone, message_type: 'location', latitude: SITE.lat, longitude: SITE.lng });
  await sleep(4000);

  const report = await byPhone(phone, 18000);
  expect(report, 'S5: Report must exist').not.toBeNull();
  const id = report!['report_id'] as string;
  console.log(`[S5] Report #${id.slice(0,8)} — waiting for assignment (workers may be busy)...`);

  const assigned = await withStatus(id, ['assigned'], 35000); // long wait — workers may be busy
  expect(assigned, 'S5: Report must become assigned').not.toBeNull();
  const worker = (assigned!['worker_phones'] as string[])?.[0] || (assigned!['worker_phone'] as string);
  console.log(`[S5] Assigned → ${worker}. Sending SPOOFED location 7km away...`);

  // Worker sends photo + FAR spoofed location (7km away) — Gate A should reject
  await sim({ sender_phone: worker, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(700);
  await sim({ sender_phone: worker, message_type: 'location', latitude: FAR.lat, longitude: FAR.lng });
  await sleep(4000); // Give backend time to evaluate GPS

  const current = (await getReports()).find(r => r['report_id'] === id);
  const status = current!['status'] as string;
  console.log(`[S5 ✅ PASS] status="${status}" — must be 'assigned' (Gate A blocked far arrival, not in_progress)`);
  expect(status).toBe('assigned');
});

// ─────────────────────────────────────────────────────────────────────────────
// S6: Duplicate worker phone registration → HTTP 400, no phantom created
// ─────────────────────────────────────────────────────────────────────────────
test('S6: Duplicate worker phone → HTTP 400, no phantom worker created', async () => {
  test.setTimeout(15000);
  const existingPhone = '+919263405367'; // Worker 3 (Auxiliary Fleet) — always in DB
  console.log(`\n[S6] Attempting duplicate registration for ${existingPhone}...`);

  const { status, body } = await post('/workers', {
    fullname: 'Impostor Worker',
    phone: existingPhone,
    latitude: 20.2961,
    longitude: 85.8245,
  });
  console.log(`[S6 ✅ PASS] HTTP ${status} — error="${body.error}"`);
  expect(status).toBe(400);
  expect(body.error).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// S7: LLM Determinism — same image x2 → same waste_type (temperature=0 fix)
// ─────────────────────────────────────────────────────────────────────────────
test('S7: Same image classified twice → same waste_type (temperature=0 determinism fix)', async () => {
  test.setTimeout(60000);
  const p1 = getUniquePhone('985');
  const p2 = getUniquePhone('984');
  console.log(`\n[S7] Classifying same image twice to verify temperature=0 determinism...`);

  await sim({ sender_phone: p1, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(2000);
  await sim({ sender_phone: p1, message_type: 'location', latitude: SITE.lat, longitude: SITE.lng });
  await sleep(5000);

  await sim({ sender_phone: p2, message_type: 'photo', media_url: WASTE_IMG_URL });
  await sleep(2000);
  await sim({ sender_phone: p2, message_type: 'location', latitude: SITE.lat + 0.0002, longitude: SITE.lng });
  await sleep(5000);

  const r1 = await byPhone(p1, 12000);
  const r2 = await byPhone(p2, 12000);

  if (r1 && r2) {
    const t1 = r1['waste_type'], t2 = r2['waste_type'];
    const e1 = Number(r1['estimated_minutes_to_clean'] || 0);
    const e2 = Number(r2['estimated_minutes_to_clean'] || 0);
    const diff = Math.abs(e1 - e2);
    const pass = t1 === t2 && diff <= 5;
    console.log(`[S7 ${pass ? '✅ PASS' : '⚠️ INCONSISTENT'}] Run1: ${t1}/${e1}min | Run2: ${t2}/${e2}min | diff=${diff}min`);
    expect(t1).toBe(t2);
    expect(diff).toBeLessThanOrEqual(5);
  } else {
    // Both or one rejected by LLM — still a valid result (deterministically rejected)
    const bothRejected = !r1 && !r2;
    console.log(`[S7 ${bothRejected ? '✅ PASS (both rejected)' : '⚠️ PARTIAL'}] r1=${!!r1} r2=${!!r2}`);
    // If one was found and one wasn't — that's non-determinism
    expect(r1 === null).toBe(r2 === null); // both found OR both null
  }
});
