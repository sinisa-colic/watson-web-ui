function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredBaseUrl = __API_BASE_URL__.replace(/\/$/, "");

  if (configuredBaseUrl) {
    return `${configuredBaseUrl}${normalizedPath}`;
  }

  if (!__APP_PROD__ && window.location.port !== String(__API_PORT__)) {
    return `${window.location.protocol}//${window.location.hostname}:${__API_PORT__}${normalizedPath}`;
  }

  return normalizedPath;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? response.statusText);
  }

  return response.json();
}
