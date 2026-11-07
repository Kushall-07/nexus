/**
 * Unit tests for apps/api/src/utils/db-safety.ts
 *
 * These tests use no database connections and no I/O.
 * They verify that the safety guards that protect the development
 * database from accidental E2E mutation behave correctly.
 */

import { describe, it, expect } from "vitest";
import {
  parseDbName,
  parsePort,
  isLocalhost,
  assertE2EDatabase,
  DatabaseSafetyError,
  APPROVED_E2E_DB,
  APPROVED_E2E_PORT,
} from "../src/utils/db-safety.js";

// ── parseDbName ───────────────────────────────────────────────────────────────

describe("parseDbName", () => {
  it("extracts database name from standard URI", () => {
    expect(parseDbName("mongodb://localhost:27017/nexus_e2e")).toBe("nexus_e2e");
  });

  it("extracts database name from 127.0.0.1 URI", () => {
    expect(parseDbName("mongodb://127.0.0.1:27017/nexus_e2e")).toBe("nexus_e2e");
  });

  it("extracts database name ignoring query params", () => {
    expect(parseDbName("mongodb://localhost:27017/nexus_e2e?authSource=admin")).toBe("nexus_e2e");
  });

  it("extracts database name from mongodb+srv URI", () => {
    expect(parseDbName("mongodb+srv://user:pass@cluster.mongodb.net/production")).toBe("production");
  });

  it("returns null when no database segment present", () => {
    expect(parseDbName("mongodb://localhost:27017")).toBeNull();
  });

  it("returns null when database segment is empty", () => {
    expect(parseDbName("mongodb://localhost:27017/")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDbName("")).toBeNull();
  });

  it("extracts nexus (dev database name)", () => {
    expect(parseDbName("mongodb://localhost:27017/nexus")).toBe("nexus");
  });
});

// ── isLocalhost ───────────────────────────────────────────────────────────────

describe("isLocalhost", () => {
  it("accepts localhost URI", () => {
    expect(isLocalhost("mongodb://localhost:27017/nexus_e2e")).toBe(true);
  });

  it("accepts 127.0.0.1 URI", () => {
    expect(isLocalhost("mongodb://127.0.0.1:27017/nexus_e2e")).toBe(true);
  });

  it("rejects Atlas URI (mongodb+srv)", () => {
    expect(isLocalhost("mongodb+srv://user:pass@cluster.mongodb.net/prod")).toBe(false);
  });

  it("rejects remote hostname", () => {
    expect(isLocalhost("mongodb://db.example.com:27017/nexus")).toBe(false);
  });

  it("rejects remote IP address", () => {
    expect(isLocalhost("mongodb://192.168.1.100:27017/nexus")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isLocalhost("")).toBe(false);
  });

  it("does not accept 127.0.0.2 (not loopback)", () => {
    expect(isLocalhost("mongodb://127.0.0.2:27017/nexus_e2e")).toBe(false);
  });
});

// ── parsePort ─────────────────────────────────────────────────────────────────

describe("parsePort", () => {
  it("extracts port from standard URI", () => {
    expect(parsePort("mongodb://localhost:27018/nexus_e2e")).toBe(27018);
  });

  it("extracts port from 127.0.0.1 URI", () => {
    expect(parsePort("mongodb://127.0.0.1:27018/nexus_e2e")).toBe(27018);
  });

  it("extracts dev port 27017 from development URI", () => {
    expect(parsePort("mongodb://localhost:27017/nexus")).toBe(27017);
  });

  it("extracts port when credentials are present in URI", () => {
    expect(parsePort("mongodb://user:pass@127.0.0.1:27018/nexus_e2e")).toBe(27018);
  });

  it("returns null when no port is specified", () => {
    expect(parsePort("mongodb://localhost/nexus_e2e")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePort("")).toBeNull();
  });

  it("returns null for mongodb+srv URI (no explicit port)", () => {
    expect(parsePort("mongodb+srv://user:pass@cluster.mongodb.net/nexus_e2e")).toBeNull();
  });
});

// ── assertE2EDatabase — approved URIs ─────────────────────────────────────────

describe("assertE2EDatabase — approved URIs", () => {
  it("passes for the standard E2E URI with localhost on port 27018", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27018/nexus_e2e"),
    ).not.toThrow();
  });

  it("passes for the standard E2E URI with 127.0.0.1 on port 27018", () => {
    expect(() =>
      assertE2EDatabase("mongodb://127.0.0.1:27018/nexus_e2e"),
    ).not.toThrow();
  });

  it("passes for E2E URI with query params on port 27018", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27018/nexus_e2e?authSource=admin"),
    ).not.toThrow();
  });
});

// ── assertE2EDatabase — rejected URIs ─────────────────────────────────────────

describe("assertE2EDatabase — rejected URIs", () => {
  it("rejects empty URI", () => {
    expect(() => assertE2EDatabase("")).toThrow(DatabaseSafetyError);
    expect(() => assertE2EDatabase("")).toThrow(/missing or empty/i);
  });

  it("rejects whitespace-only URI", () => {
    expect(() => assertE2EDatabase("   ")).toThrow(DatabaseSafetyError);
  });

  it("rejects the development database URI (nexus)", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27017/nexus"),
    ).toThrow(DatabaseSafetyError);

    expect(() =>
      assertE2EDatabase("mongodb://localhost:27017/nexus"),
    ).toThrow(/"nexus_e2e".*"nexus"/);
  });

  it("rejects URI without a database name", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27017"),
    ).toThrow(DatabaseSafetyError);
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27017"),
    ).toThrow(/does not contain a database name/i);
  });

  it("rejects URI with empty database segment", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27017/"),
    ).toThrow(DatabaseSafetyError);
  });

  it("rejects Atlas URI", () => {
    expect(() =>
      assertE2EDatabase("mongodb+srv://user:pass@cluster.mongodb.net/nexus_e2e"),
    ).toThrow(DatabaseSafetyError);
    expect(() =>
      assertE2EDatabase("mongodb+srv://user:pass@cluster.mongodb.net/nexus_e2e"),
    ).toThrow(/localhost.*127\.0\.0\.1/i);
  });

  it("rejects remote hostname URI even with correct db name", () => {
    expect(() =>
      assertE2EDatabase("mongodb://db.example.com:27017/nexus_e2e"),
    ).toThrow(DatabaseSafetyError);
  });

  it("rejects any db name that is not the approved name", () => {
    const badNames = ["nexus", "nexus_dev", "nexus_prod", "production", "test", "admin"];
    for (const db of badNames) {
      expect(() =>
        assertE2EDatabase(`mongodb://localhost:27017/${db}`),
      ).toThrow(DatabaseSafetyError);
    }
  });

  it("rejects when db name is a prefix of approved name", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27017/nexus_e2"),
    ).toThrow(DatabaseSafetyError);
  });

  it("rejects when db name is a superset of approved name", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27018/nexus_e2e_extra"),
    ).toThrow(DatabaseSafetyError);
  });

  it("rejects the development port 27017 even with correct db name", () => {
    expect(() =>
      assertE2EDatabase("mongodb://127.0.0.1:27017/nexus_e2e"),
    ).toThrow(DatabaseSafetyError);
    expect(() =>
      assertE2EDatabase("mongodb://127.0.0.1:27017/nexus_e2e"),
    ).toThrow(/port 27018/i);
  });

  it("rejects localhost:27017 even with correct db name", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost:27017/nexus_e2e"),
    ).toThrow(DatabaseSafetyError);
  });

  it("rejects URI with no port specified", () => {
    expect(() =>
      assertE2EDatabase("mongodb://localhost/nexus_e2e"),
    ).toThrow(DatabaseSafetyError);
    expect(() =>
      assertE2EDatabase("mongodb://localhost/nexus_e2e"),
    ).toThrow(/port 27018/i);
  });

  it("rejects any port that is not 27018", () => {
    for (const port of [27017, 27019, 27020, 5432, 3306]) {
      expect(() =>
        assertE2EDatabase(`mongodb://localhost:${port}/nexus_e2e`),
      ).toThrow(DatabaseSafetyError);
    }
  });
});

// ── APPROVED_E2E_DB / APPROVED_E2E_PORT constants ────────────────────────────

describe("APPROVED_E2E_DB", () => {
  it("is exactly nexus_e2e", () => {
    expect(APPROVED_E2E_DB).toBe("nexus_e2e");
  });
});

describe("APPROVED_E2E_PORT", () => {
  it("is exactly 27018 (the dedicated E2E container port)", () => {
    expect(APPROVED_E2E_PORT).toBe(27018);
  });
});

// ── DatabaseSafetyError ───────────────────────────────────────────────────────

describe("DatabaseSafetyError", () => {
  it("is an instance of Error", () => {
    const err = new DatabaseSafetyError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("has name DatabaseSafetyError", () => {
    const err = new DatabaseSafetyError("test");
    expect(err.name).toBe("DatabaseSafetyError");
  });

  it("preserves the message", () => {
    const err = new DatabaseSafetyError("protect the db");
    expect(err.message).toBe("protect the db");
  });
});
