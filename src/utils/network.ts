export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  fallback?: () => Promise<Response>;
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1000,
    fallback,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new NetworkError(
          `Request timeout after ${timeout}ms`,
          'TIMEOUT',
          undefined,
          error
        );
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  if (fallback) {
    try {
      return await fallback();
    } catch {
      // Fallback also failed, throw original error
    }
  }

  throw lastError || new NetworkError('Request failed', 'UNKNOWN');
}

export async function loadScriptWithTimeout(
  url: string,
  timeout = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;

    const timer = setTimeout(() => {
      script.remove();
      reject(new NetworkError(`Script load timeout: ${url}`, 'TIMEOUT'));
    }, timeout);

    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };

    script.onerror = () => {
      clearTimeout(timer);
      reject(new NetworkError(`Script load failed: ${url}`, 'LOAD_ERROR'));
    };

    document.head.appendChild(script);
  });
}

export async function loadWasmWithTimeout(
  url: string,
  timeout = 15000
): Promise<WebAssembly.Module> {
  const response = await fetchWithTimeout(url, { timeout });
  if (!response.ok) {
    throw new NetworkError(`WASM load failed: ${response.status}`, 'HTTP_ERROR', response.status);
  }
  const bytes = await response.arrayBuffer();
  return await WebAssembly.compile(bytes);
}

export function createCdnFallback<T>(
  primaryUrl: string,
  fallbackUrls: string[],
  loader: (url: string) => Promise<T>
): () => Promise<T> {
  return async () => {
    try {
      return await loader(primaryUrl);
    } catch (primaryError) {
      for (const fallbackUrl of fallbackUrls) {
        try {
          console.warn(`Primary failed, trying fallback: ${fallbackUrl}`);
          return await loader(fallbackUrl);
        } catch {
          continue;
        }
      }
      throw primaryError;
    }
  };
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
}