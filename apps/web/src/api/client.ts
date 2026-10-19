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

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
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
