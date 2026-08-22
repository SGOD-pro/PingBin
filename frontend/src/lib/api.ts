/**
 * Helper to resolve the backend API URL directly from VITE_API_URL environment variable.
 * Configurable for localhost, cloudflared tunnel, or deployed AWS API Gateway/Lambda URL.
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}
