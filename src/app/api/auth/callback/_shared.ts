import { NextResponse } from "next/server";
import { exchangeCode, persistTokens, type OAuthProvider } from "@/lib/auth/oauth";
import { DEMO_USER_ID } from "@/lib/db";

async function handleCallback(
  request: Request,
  provider: OAuthProvider,
) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=missing_code", request.url));
  }

  let userId = DEMO_USER_ID;
  const state = url.searchParams.get("state");
  if (state) {
    try {
      const parsed = JSON.parse(
        Buffer.from(state, "base64url").toString("utf8"),
      ) as { userId?: string };
      if (parsed.userId) userId = parsed.userId;
    } catch {
      // ignore malformed state
    }
  }

  try {
    const tokens = await exchangeCode(provider, code);
    await persistTokens(userId, provider, tokens);
    return NextResponse.redirect(
      new URL(`/settings?connected=${provider}`, request.url),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  // This file is unused — individual callback routes below
  void request;
  void context;
  return NextResponse.json({ error: "Use provider-specific callback" }, { status: 404 });
}

export { handleCallback };
