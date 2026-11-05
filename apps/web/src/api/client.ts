export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

interface RawUpload {
  body: Blob;
  headers: Record<string, string>;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  raw?: RawUpload,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      headers: raw ? raw.headers : body === undefined ? undefined : { "Content-Type": "application/json" },
      body: raw ? raw.body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "The NEXUS API could not be reached.");
  }

  let envelope: Envelope<T> | null = null;

  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    envelope = null;
  }

  // A 401 from any data endpoint means the session ended; the auth layer owns
  // /api/auth/* itself, so those are not reported here.
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    unauthorizedListeners.forEach((listener) => listener());
  }

  if (!response.ok || !envelope || envelope.success !== true || envelope.data === undefined) {
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? "UNKNOWN_ERROR",
      envelope?.error?.message ?? "The request failed.",
    );
  }

  return envelope.data;
}

export const apiGet = <T,>(path: string): Promise<T> => request<T>("GET", path);
export const apiPost = <T,>(path: string, body?: unknown): Promise<T> => request<T>("POST", path, body);
export const apiPatch = <T,>(path: string, body?: unknown): Promise<T> => request<T>("PATCH", path, body);
export const apiPut = <T,>(path: string, body?: unknown): Promise<T> => request<T>("PUT", path, body);
export const apiDelete = <T,>(path: string, body?: unknown): Promise<T> => request<T>("DELETE", path, body);
// Sends a file as the raw request body (used for resume extraction).
export const apiUpload = <T,>(path: string, file: File, headers: Record<string, string> = {}): Promise<T> =>
  request<T>("POST", path, undefined, { body: file, headers: { "Content-Type": "application/octet-stream", ...headers } });
