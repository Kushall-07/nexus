/**
 * Structured JSON logger.
 *
 * Writes one JSON object per line to stdout so the output can be consumed by
 * any log aggregator (or simply read by humans with `jq`). No external
 * dependencies or paid infrastructure required.
 *
 * Rules:
 * - Never include credential values (tokens, keys, encrypted blobs).
 * - Never throw — a logging failure must not break a request.
 */

type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  try {
    const entry = { ts: new Date().toISOString(), level, msg, ...fields };
    process.stdout.write(JSON.stringify(entry) + "\n");
  } catch {
    // A logger must never crash the process.
  }
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
