/**
 * Returns the sanitized base URL for API requests.
 * Ensures that any obsolete localhost:8000 environment setting resolves to relative URL ''.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string) || '';
  if (
    !envUrl ||
    envUrl.includes('localhost:8000') ||
    envUrl.includes('127.0.0.1:8000') ||
    envUrl === '/'
  ) {
    return '';
  }
  return envUrl.replace(/\/$/, '');
}
