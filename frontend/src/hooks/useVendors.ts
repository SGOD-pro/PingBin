import { useState, useEffect, useCallback } from 'react';
import type { VendorItem, CouponTemplate } from '../types';
import { getApiUrl } from '../lib/api';

export function useVendors() {
  const API_URL = getApiUrl();
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/vendors`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: VendorItem[] = await res.json();
      setVendors(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  }, []);

  const addVendor = useCallback(
    async (payload: {
      vendor_name: string;
      category: string;
      description?: string;
      city?: string;
      area?: string;
      latitude?: number;
      longitude?: number;
      coupon_templates?: CouponTemplate[];
    }) => {
      const res = await fetch(`${API_URL}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to create vendor: ${res.status}`);
      await fetchVendors();
      return res.json();
    },
    [fetchVendors]
  );

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  return { vendors, loading, error, fetchVendors, addVendor };
}
