/**
 * api.ts — Centralized API service layer for PingBin
 * ====================================================
 * EVERY backend call in the entire application goes through this module.
 * Centralizes endpoint URLs, timeouts, headers, and error handling.
 */

import type {
  ReportItem,
  WorkerItem,
  WarehouseItem,
  VendorItem,
  CouponItem,
} from '../types';

export function getApiUrl(): string {
  const envUrl =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

const API_BASE = getApiUrl();

// ── Internal fetch wrapper & Error Definitions ──────────────────────────────

export interface ApiFetchOptions extends RequestInit {
  /** Timeout in milliseconds. Defaults to 25s (or 5s for fast health checks). */
  timeoutMs?: number;
}

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { timeoutMs = 25_000, ...fetchOpts } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${cleanPath}`;

  try {
    const res = await fetch(url, {
      ...fetchOpts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOpts.headers,
      },
    });

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      const errMsg =
        typeof body === 'object' && body !== null && 'detail' in body
          ? String((body as { detail: unknown }).detail)
          : `HTTP ${res.status}: ${res.statusText || 'Request failed'}`;

      throw new ApiError(errMsg, res.status, body);
    }

    // Handle 204 No Content
    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs / 1000}s`, 408);
    }
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public API Services ─────────────────────────────────────────────────────

/** Health check — 5s timeout, used by BackendHealthGate */
export async function checkHealth(): Promise<{ status: string; service?: string; version?: string }> {
  return apiFetch<{ status: string; service?: string; version?: string }>('/health', {
    timeoutMs: 5_000,
  });
}

// --- Reports ---
export async function getReports(): Promise<ReportItem[]> {
  return apiFetch<ReportItem[]>('/reports');
}

export async function getReportById(reportId: string): Promise<ReportItem> {
  return apiFetch<ReportItem>(`/reports/${encodeURIComponent(reportId)}`);
}

export async function approveReport(
  reportId: string,
): Promise<{ status: string; report_id: string; priority_score?: number }> {
  return apiFetch<{ status: string; report_id: string; priority_score?: number }>(
    `/reports/${encodeURIComponent(reportId)}/approve`,
    {
      method: 'POST',
    },
  );
}

export async function rejectReport(
  reportId: string,
): Promise<{ status: string; report_id: string }> {
  return apiFetch<{ status: string; report_id: string }>(
    `/reports/${encodeURIComponent(reportId)}/reject`,
    {
      method: 'POST',
    },
  );
}

// --- Workers ---
export async function getWorkers(): Promise<WorkerItem[]> {
  return apiFetch<WorkerItem[]>('/workers');
}

export async function createWorker(
  worker: Omit<WorkerItem, 'worker_id' | 'created_at'> & { worker_id?: string },
): Promise<WorkerItem> {
  return apiFetch<WorkerItem>('/workers', {
    method: 'POST',
    body: JSON.stringify(worker),
  });
}

export async function updateWorker(
  workerId: string,
  payload: Partial<WorkerItem>,
): Promise<WorkerItem> {
  return apiFetch<WorkerItem>(`/workers/${encodeURIComponent(workerId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteWorker(
  workerId: string,
): Promise<{ success: boolean; worker_id: string }> {
  return apiFetch<{ success: boolean; worker_id: string }>(
    `/workers/${encodeURIComponent(workerId)}`,
    {
      method: 'DELETE',
    },
  );
}

// --- Warehouses & Recycling ---
export async function getWarehouses(): Promise<WarehouseItem[]> {
  return apiFetch<WarehouseItem[]>('/warehouses');
}

export async function createWarehouse(
  warehouse: {
    name: string;
    category: string;
    rate_per_kg: number;
    capacity_kg: number;
    address?: string;
    latitude?: number;
    longitude?: number;
    accepted_categories?: string[];
  },
): Promise<{ status: string; warehouse: WarehouseItem }> {
  return apiFetch<{ status: string; warehouse: WarehouseItem }>('/warehouses', {
    method: 'POST',
    body: JSON.stringify(warehouse),
  });
}

export async function assignReportToWarehouse(
  reportId: string,
  warehouseId: string,
  actualWeightKg: number,
): Promise<{ status: string; result: any }> {
  return apiFetch<{ status: string; result: any }>(
    `/reports/${encodeURIComponent(reportId)}/assign-warehouse`,
    {
      method: 'POST',
      body: JSON.stringify({
        warehouse_id: warehouseId,
        actual_weight_kg: actualWeightKg,
      }),
    },
  );
}

export async function pruneTestData(): Promise<{ status: string; deleted_reports: number; retained_reports: number }> {
  return apiFetch<{ status: string; deleted_reports: number; retained_reports: number }>('/reports/prune-test-data', {
    method: 'POST',
  });
}

// --- Vendors & Rewards ---
export async function getVendors(): Promise<VendorItem[]> {
  return apiFetch<VendorItem[]>('/vendors');
}

export async function createVendor(
  vendor: Partial<VendorItem> & { vendor_name: string; category: string },
): Promise<VendorItem> {
  return apiFetch<VendorItem>('/vendors', {
    method: 'POST',
    body: JSON.stringify(vendor),
  });
}

export async function getCoupons(): Promise<CouponItem[]> {
  return apiFetch<CouponItem[]>('/coupons');
}

// --- Dev & Live Simulation ---
export async function simulateMessage(
  payload: Record<string, unknown>,
): Promise<{ status: string; message?: string; report_id?: string }> {
  return apiFetch<{ status: string; message?: string; report_id?: string }>(
    '/dev/simulate-message',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
