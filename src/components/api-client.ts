export class ApiError extends Error {
 constructor(message: string, public code?: string, public status?: number) { super(message); this.name = 'ApiError'; }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
 const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options?.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options?.headers } });
 const data = await response.json().catch(() => ({}));
 if (!response.ok) {
  const message = typeof data.error === 'string' ? data.error : data.error?.message ?? data.message ?? 'Something went wrong. Please try again.';
  throw new ApiError(message, data.error?.code ?? data.code, response.status);
 }
 return data as T;
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
