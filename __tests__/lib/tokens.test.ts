import { describe, expect, it, beforeEach } from "vitest";
import { encrypt, decrypt, encryptJson, decryptJson } from "@/lib/crypto/tokens";

describe("token encryption", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-32chars-min!!";
    process.env.DEMO_MODE = "true";
  });

  it("round-trips plaintext", () => {
    const token = encrypt("secret-access-token");
    expect(token.ciphertext).toBeTruthy();
    expect(token.iv).toBeTruthy();
    expect(token.tag).toBeTruthy();
    expect(decrypt(token)).toBe("secret-access-token");
  });

  it("round-trips JSON payloads", () => {
    const payload = { accessToken: "abc", refreshToken: "def" };
    const enc = encryptJson(payload);
    expect(decryptJson<typeof payload>(enc)).toEqual(payload);
  });

  it("fails on tampered ciphertext", () => {
    const token = encrypt("hello");
    token.ciphertext = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(token)).toThrow();
  });
});
