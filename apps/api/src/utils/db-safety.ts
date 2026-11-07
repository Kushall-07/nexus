/**
 * Database URI safety guards for the E2E test environment.
 *
 * These are pure-logic helpers — no I/O, no database connections.
 * They are imported by the E2E global setup/teardown scripts and are
 * independently testable via the API unit-test suite.
 *
 * Design: fail closed.
 * Every destructive E2E database operation must pass through assertE2EDatabase
 * before it may proceed.  Any unexpected URI causes an immediate throw.
 */

export const APPROVED_E2E_DB = "nexus_e2e";
export const APPROVED_E2E_PORT = 27018;

export class DatabaseSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseSafetyError";
  }
}

/**
 * Extracts the database name from a MongoDB connection string.
 * Returns null when no database segment is present.
 *
 * Handles:
 *   mongodb://host:port/dbname
 *   mongodb://host:port/dbname?options
 *   mongodb+srv://host/dbname
 *   mongodb+srv://host/dbname?options
 */
export function parseDbName(uri: string): string | null {
  if (!uri || typeof uri !== "string") return null;

  try {
    // Strip protocol
    const withoutProto = uri.replace(/^mongodb(\+srv)?:\/\//, "");
    // Find the first "/" that separates host from path
    const slashIndex = withoutProto.indexOf("/");
    if (slashIndex === -1) return null;

    // Everything after the first "/" is the path; strip query params
    const pathSegment = withoutProto.slice(slashIndex + 1).split("?")[0].split("/")[0];
    return pathSegment.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Extracts the numeric port from a MongoDB connection URI.
 * Returns null when no port is explicitly specified.
 *
 * Handles:
 *   mongodb://host:27018/db      → 27018
 *   mongodb://user:pass@host:27018/db  → 27018  (strips credentials)
 *   mongodb://host/db            → null (no port)
 *   mongodb+srv://host/db        → null (SRV records have no explicit port)
 */
export function parsePort(uri: string): number | null {
  if (!uri || typeof uri !== "string") return null;
  try {
    const withoutProto = uri.replace(/^mongodb(\+srv)?:\/\//, "");
    // Strip credentials: user:pass@host:port → host:port
    const atIndex = withoutProto.indexOf("@");
    const hostSection = atIndex === -1
      ? withoutProto.split("/")[0]
      : withoutProto.slice(atIndex + 1).split("/")[0];
    // hostSection is "host:port"; find the last colon (handles IPv6 as well)
    const colonIndex = hostSection.lastIndexOf(":");
    if (colonIndex === -1) return null;
    const portStr = hostSection.slice(colonIndex + 1);
    const port = parseInt(portStr, 10);
    return isNaN(port) || port < 1 || port > 65535 ? null : port;
  } catch {
    return null;
  }
}

/**
 * Returns true when the URI targets only localhost or the loopback address.
 * Atlas (mongodb+srv://), remote hostnames, and IP ranges other than 127.0.0.1
 * are rejected.
 */
export function isLocalhost(uri: string): boolean {
  if (!uri || typeof uri !== "string") return false;
  if (uri.includes("mongodb+srv://")) return false;
  return /(?:^|@|\/\/)(?:localhost|127\.0\.0\.1)/.test(uri);
}

/**
 * Throws DatabaseSafetyError unless ALL of the following are true:
 *
 *   1. uri is a non-empty string.
 *   2. The URI targets localhost or 127.0.0.1 (not Atlas, not remote).
 *   3. A database name is present in the URI.
 *   4. The database name exactly equals `approved` (default: "nexus_e2e").
 *
 * Pass `approved` only in tests that check rejection of unexpected names.
 * Production callers always use the default.
 */
export function assertE2EDatabase(uri: string, approved = APPROVED_E2E_DB): void {
  if (!uri || uri.trim() === "") {
    throw new DatabaseSafetyError("MONGODB_URI is missing or empty.");
  }

  if (!isLocalhost(uri)) {
    throw new DatabaseSafetyError(
      "E2E MONGODB_URI must target localhost or 127.0.0.1. " +
        "Remote hosts (including Atlas) are not permitted for E2E tests.",
    );
  }

  const dbName = parseDbName(uri);

  if (!dbName) {
    throw new DatabaseSafetyError(
      "MONGODB_URI does not contain a database name. " +
        `Append "/${approved}" to the URI.`,
    );
  }

  if (dbName !== approved) {
    throw new DatabaseSafetyError(
      `E2E database must be "${approved}" but URI points to "${dbName}". ` +
        `Refusing to operate on "${dbName}" to protect the development database.`,
    );
  }

  const port = parsePort(uri);
  if (port !== APPROVED_E2E_PORT) {
    throw new DatabaseSafetyError(
      `E2E MONGODB_URI must use port ${APPROVED_E2E_PORT} (the dedicated E2E container) ` +
        `but the URI specifies port ${port ?? "none"}. ` +
        `Port ${APPROVED_E2E_PORT} maps to the nexus-mongodb-e2e container; ` +
        `port 27017 is the development database.`,
    );
  }
}
