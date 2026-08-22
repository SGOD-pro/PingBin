import { useState, useEffect, useCallback } from 'react';
import type { WorkerItem } from '../types';
import { getApiUrl } from '../lib/api';

export function useWorkers() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = getApiUrl();

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/workers`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: WorkerItem[] = await res.json();
      setWorkers(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  const addWorker = async (workerData: {
    fullname: string;
    phone: string;
    latitude: number;
    longitude: number;
    photo_url?: string;
  }) => {
    try {
      const res = await fetch(`${API_URL}/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workerData),
      });
      if (!res.ok) throw new Error('Failed to add worker');
      await fetchWorkers();
      return true;
    } catch (e) {
      console.error('Error adding worker:', e);
      return false;
    }
  };

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, [fetchWorkers]);

  return { workers, loading, error, refreshWorkers: fetchWorkers, addWorker };
}
