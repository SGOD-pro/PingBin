import { useState, useEffect, useCallback } from 'react';
import type { VendorItem, CouponTemplate } from '../types';
import * as api from '../lib/api';

export function useVendors() {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    try {
      const data = await api.getVendors();
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
      const res = await api.createVendor(payload);
      await fetchVendors();
      return res;
    },
    [fetchVendors]
  );

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  return { vendors, loading, error, fetchVendors, addVendor };
}
