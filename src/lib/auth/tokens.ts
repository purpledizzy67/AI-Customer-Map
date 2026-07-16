/**
 * Resolve a decrypted access token for a connected provider.
 * Supports reconnect flow when tokens are missing/expired.
 */

import { decrypt, encrypt } from "@/lib/crypto/tokens";
import {
  getStoredOAuthAccount,
  upsertOAuthAccount,
} from "@/lib/db";
import { refreshGoogleToken } from "@/lib/auth/oauth";
import { isDemoMode } from "@/lib/config";
import type { Provider } from "@/types";

export class NotConnectedError extends Error {
  constructor(public provider: Provider) {
    super(`${provider} is not connected. Reconnect from Settings.`);
    this.name = "NotConnectedError";
  }
}

export async function getAccessToken(
  userId: string,
  provider: Provider,
): Promise<string | null> {
  if (isDemoMode()) {
    const account = await getStoredOAuthAccount(userId, provider);
    if (!account) return null;
  }

  const account = await getStoredOAuthAccount(userId, provider);
  if (!account) return null;

  if (
    account.expiresAt &&
    new Date(account.expiresAt).getTime() < Date.now() + 60_000
  ) {
    if (provider === "google" || provider === "gmail" || provider === "calendar") {
      if (!account.refreshToken) {
        account.status = "expired";
        await upsertOAuthAccount(account);
        return null;
      }
      const refresh = decrypt(account.refreshToken);
      const renewed = await refreshGoogleToken(refresh);
      account.accessToken = encrypt(renewed.accessToken);
      account.expiresAt = renewed.expiresAt;
      account.status = "connected";
      account.updatedAt = new Date().toISOString();
      await upsertOAuthAccount(account);
      return renewed.accessToken;
    }
  }

  return decrypt(account.accessToken);
}

export async function requireAccessToken(
  userId: string,
  provider: Provider,
): Promise<string> {
  const token = await getAccessToken(userId, provider);
  if (!token) throw new NotConnectedError(provider);
  return token;
}
