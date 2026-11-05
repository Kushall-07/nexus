import type { JobProviderId, JobSearchQuery, NormalizedJob } from "../types.js";

// Provider-neutral job source contract. Adapters call a fixed, hard-coded
// upstream host (never a URL derived from user or model input), so outbound
// requests cannot be redirected to arbitrary servers.

export type ProviderFailureKind = "rate_limited" | "timeout" | "network" | "auth" | "bad_response" | "upstream";

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderFailureKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ProviderStatus {
  id: JobProviderId;
  label: string;
  configured: boolean;
  // How to enable it; never contains a credential value.
  hint?: string;
}

export interface JobProvider {
  readonly id: JobProviderId;
  readonly label: string;
  status(): ProviderStatus;
  search(query: JobSearchQuery, now: Date): Promise<NormalizedJob[]>;
}

export interface ProviderDeps {
  fetchImpl?: typeof fetch;
  timeoutMs: number;
}

const MAX_BODY_BYTES = 2_000_000;

// GET JSON with a hard timeout, a bounded body and mapped failure kinds.
export async function fetchJson(
  url: string,
  init: { headers?: Record<string, string> },
  deps: ProviderDeps,
): Promise<unknown> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  let response: Response;

  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(deps.timeoutMs),
      redirect: "error", // a provider must not bounce us to another host
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ProviderError(timedOut ? "timeout" : "network", "The job provider could not be reached.");
  }

  if (response.status === 429) throw new ProviderError("rate_limited", "The job provider rate limit was reached.", 429);
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError("auth", "The job provider rejected the configured credentials.", response.status);
  }
  if (!response.ok) throw new ProviderError("upstream", `The job provider returned status ${response.status}.`, response.status);

  try {
    const text = await response.text();
    if (text.length > MAX_BODY_BYTES) throw new Error("oversized");
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError("bad_response", "The job provider returned an unreadable response.");
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
