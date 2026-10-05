import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../src/utils/token-encryption.js";

describe("GitHub token encryption", () => {
  it("round-trips a token through encrypt/decrypt", () => {
    const token = "gho_exampleAccessToken1234567890";

    const encrypted = encryptToken(token);

    expect(decryptToken(encrypted)).toBe(token);
  });

  it("does not store the plaintext token in the ciphertext", () => {
    const token = "gho_anotherSecretValue";

    const encrypted = encryptToken(token);

    expect(encrypted).not.toContain(token);
    expect(encrypted).not.toBe(token);
  });

  it("produces different ciphertext for the same token on repeated calls (random IV)", () => {
    const token = "gho_sameTokenEncryptedTwice";

    const first = encryptToken(token);
    const second = encryptToken(token);

    expect(first).not.toBe(second);
    expect(decryptToken(first)).toBe(token);
    expect(decryptToken(second)).toBe(token);
  });

  it("rejects a malformed encrypted value", () => {
    expect(() => decryptToken("not-a-valid-encrypted-token")).toThrow();
  });

  it("rejects an encrypted value with a tampered auth tag", () => {
    const encrypted = encryptToken("gho_integrityCheck");
    const [iv, authTag, ciphertext] = encrypted.split(".");

    const tamperedAuthTag = Buffer.from(authTag, "base64");
    tamperedAuthTag[0] = tamperedAuthTag[0] ^ 0xff;

    const tampered = [iv, tamperedAuthTag.toString("base64"), ciphertext].join(".");

    expect(() => decryptToken(tampered)).toThrow();
  });
});
