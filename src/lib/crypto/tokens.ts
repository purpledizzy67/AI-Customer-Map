/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 * Never store plaintext tokens in the database.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { EncryptedToken } from "@/types";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    if (process.env.DEMO_MODE === "true") {
      return "demo-encryption-key-not-for-production";
    }
    throw new Error("ENCRYPTION_KEY must be set (min 16 characters)");
  }
  return key;
}

export function encrypt(plaintext: string, secret = getEncryptionKey()): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(token: EncryptedToken, secret = getEncryptionKey()): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret),
    Buffer.from(token.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(token.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(token.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function encryptJson<T>(value: T): EncryptedToken {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(token: EncryptedToken): T {
  return JSON.parse(decrypt(token)) as T;
}
