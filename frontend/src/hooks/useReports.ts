import { useState, useEffect, useCallback } from 'react';
import type { ReportItem } from '../types';
import { getApiUrl } from '../lib/api';

export function useReports() {
  const API_URL = getApiUrl();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/reports`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data: ReportItem[] = await res.json();
      // Sort by priority_score descending
      data.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
      setReports(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    // 5-second polling interval (Rule 3.4)
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  return { reports, loading, error, lastUpdated, refresh: fetchReports };
}
