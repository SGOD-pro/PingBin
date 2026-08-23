import { useState, useEffect, useCallback } from 'react';
import type { WorkerItem } from '../types';
import * as api from '../lib/api';

export function useWorkers() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = useCallback(async () => {
    try {
      const data = await api.getWorkers();
      setWorkers(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const addWorker = async (workerData: {
    fullname: string;
    phone: string;
    latitude: number;
    longitude: number;
    photo_url?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.createWorker({
        name: workerData.fullname,
        phone: workerData.phone,
        last_known_location: {
          lat: workerData.latitude,
          lng: workerData.longitude,
        },
        photo_url: workerData.photo_url,
        status: 'free',
      });
      await fetchWorkers();
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      console.error('Error adding worker:', e);
      return { success: false, error: msg };
    }
  };

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, [fetchWorkers]);

  return { workers, loading, error, refreshWorkers: fetchWorkers, addWorker };
}
