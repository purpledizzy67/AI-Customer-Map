/**
 * OAuth helpers — authorize URL builders, token exchange, refresh.
 * Tokens are encrypted before persistence via upsertOAuthAccount.
 */

import { config } from "@/lib/config";
import { encrypt } from "@/lib/crypto/tokens";
import { newId, upsertOAuthAccount, type StoredOAuthAccount } from "@/lib/db";
import type { Provider, TokenBundle } from "@/types";

export type OAuthProvider = "google" | "slack" | "github" | "notion";

export function getAuthorizeUrl(
  provider: OAuthProvider,
  state: string,
): string {
  switch (provider) {
    case "google": {
      const params = new URLSearchParams({
        client_id: config.google.clientId,
        redirect_uri: config.google.redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: config.google.scopes.join(" "),
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    case "slack": {
      const params = new URLSearchParams({
        client_id: config.slack.clientId,
        redirect_uri: config.slack.redirectUri,
        scope: config.slack.scopes.join(","),
        state,
      });
      return `https://slack.com/oauth/v2/authorize?${params}`;
    }
    case "github": {
      const params = new URLSearchParams({
        client_id: config.github.clientId,
        redirect_uri: config.github.redirectUri,
        scope: config.github.scopes.join(" "),
        state,
      });
      return `https://github.com/login/oauth/authorize?${params}`;
    }
    case "notion": {
      const params = new URLSearchParams({
        client_id: config.notion.clientId,
        redirect_uri: config.notion.redirectUri,
        response_type: "code",
        owner: "user",
        state,
      });
      return `https://api.notion.com/v1/oauth/authorize?${params}`;
    }
  }
}

export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
): Promise<TokenBundle & { accountEmail?: string; accountName?: string; scopes: string[] }> {
  switch (provider) {
    case "google": {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: config.google.redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
      };
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const profile = profileRes.ok
        ? ((await profileRes.json()) as { email?: string; name?: string })
        : {};
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : undefined,
        tokenType: data.token_type,
        scope: data.scope,
        accountEmail: profile.email,
        accountName: profile.name,
        scopes: (data.scope ?? "").split(" ").filter(Boolean),
      };
    }
    case "slack": {
      const res = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          redirect_uri: config.slack.redirectUri,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        access_token?: string;
        scope?: string;
        authed_user?: { access_token?: string; id?: string };
        team?: { name?: string };
        error?: string;
      };
      if (!data.ok || !data.access_token) {
        throw new Error(`Slack token exchange failed: ${data.error ?? "unknown"}`);
      }
      return {
        accessToken: data.access_token,
        accountName: data.team?.name,
        scopes: (data.scope ?? "").split(",").filter(Boolean),
      };
    }
    case "github": {
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: config.github.clientId,
          client_secret: config.github.clientSecret,
          code,
          redirect_uri: config.github.redirectUri,
        }),
      });
      const data = (await res.json()) as {
        access_token?: string;
        scope?: string;
        token_type?: string;
        error?: string;
      };
      if (!data.access_token) {
        throw new Error(`GitHub token exchange failed: ${data.error ?? "unknown"}`);
      }
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          Accept: "application/vnd.github+json",
        },
      });
      const user = userRes.ok
        ? ((await userRes.json()) as { login?: string; email?: string; name?: string })
        : {};
      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        scope: data.scope,
        accountEmail: user.email ?? undefined,
        accountName: user.login ?? user.name,
        scopes: (data.scope ?? "").split(",").filter(Boolean),
      };
    }
    case "notion": {
      const basic = Buffer.from(
        `${config.notion.clientId}:${config.notion.clientSecret}`,
      ).toString("base64");
      const res = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: config.notion.redirectUri,
        }),
      });
      if (!res.ok) throw new Error(`Notion token exchange failed: ${res.status}`);
      const data = (await res.json()) as {
        access_token: string;
        workspace_name?: string;
        owner?: { user?: { name?: string; person?: { email?: string } } };
      };
      return {
        accessToken: data.access_token,
        accountName: data.workspace_name ?? data.owner?.user?.name,
        accountEmail: data.owner?.user?.person?.email,
        scopes: [],
      };
    }
  }
}

export async function persistTokens(
  userId: string,
  provider: Provider,
  tokens: TokenBundle & {
    accountEmail?: string;
    accountName?: string;
    scopes: string[];
  },
): Promise<StoredOAuthAccount> {
  const now = new Date().toISOString();
  const account: StoredOAuthAccount = {
    id: newId(),
    userId,
    provider,
    accountEmail: tokens.accountEmail,
    accountName: tokens.accountName,
    status: "connected",
    scopes: tokens.scopes,
    connectedAt: now,
    updatedAt: now,
    expiresAt: tokens.expiresAt,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
  };
  return upsertOAuthAccount(account);
}

export async function refreshGoogleToken(
  refreshToken: string,
): Promise<TokenBundle> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google refresh failed: ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    token_type?: string;
  };
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    tokenType: data.token_type,
  };
}
