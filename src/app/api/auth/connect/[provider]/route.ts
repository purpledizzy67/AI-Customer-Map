import { NextResponse } from "next/server";
import { getAuthorizeUrl, type OAuthProvider } from "@/lib/auth/oauth";
import { isDemoMode } from "@/lib/config";
import { DEMO_USER_ID, upsertOAuthAccount, newId } from "@/lib/db";
import { encrypt } from "@/lib/crypto/tokens";

const PROVIDERS: OAuthProvider[] = ["google", "slack", "github", "notion"];

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!PROVIDERS.includes(provider as OAuthProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const url = new URL(request.url);
  const reconnect = url.searchParams.get("reconnect") === "1";

  // Demo mode: simulate connection without real OAuth
  if (isDemoMode()) {
    const now = new Date().toISOString();
    await upsertOAuthAccount({
      id: newId(),
      userId: DEMO_USER_ID,
      provider: provider as OAuthProvider,
      accountEmail: `demo+${provider}@workassistant.ai`,
      accountName: `Demo ${provider}`,
      status: "connected",
      scopes: ["demo"],
      connectedAt: now,
      updatedAt: now,
      accessToken: encrypt("demo-access-token"),
    });
    return NextResponse.redirect(
      new URL(`/settings?connected=${provider}${reconnect ? "&reconnected=1" : ""}`, request.url),
    );
  }

  const state = Buffer.from(
    JSON.stringify({
      userId: DEMO_USER_ID,
      provider,
      reconnect,
      nonce: crypto.randomUUID(),
    }),
  ).toString("base64url");

  const authorizeUrl = getAuthorizeUrl(provider as OAuthProvider, state);
  return NextResponse.redirect(authorizeUrl);
}
