/**
 * Application configuration — single source of truth for env vars.
 */

export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  // Auto-demo when core secrets missing
  return !process.env.OPENAI_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1",
  confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD ?? "0.8"),
  collectIntervalMinutes: Number(process.env.COLLECT_INTERVAL_MINUTES ?? "15"),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ??
      "http://localhost:3000/api/auth/callback/google",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID ?? "",
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.SLACK_REDIRECT_URI ??
      "http://localhost:3000/api/auth/callback/slack",
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
    scopes: [
      "channels:history",
      "channels:read",
      "groups:history",
      "groups:read",
      "im:history",
      "mpim:history",
      "search:read",
      "users:read",
      "reactions:read",
    ],
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GITHUB_REDIRECT_URI ??
      "http://localhost:3000/api/auth/callback/github",
    scopes: ["repo", "read:user", "notifications"],
  },
  notion: {
    clientId: process.env.NOTION_CLIENT_ID ?? "",
    clientSecret: process.env.NOTION_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.NOTION_REDIRECT_URI ??
      "http://localhost:3000/api/auth/callback/notion",
  },
  n8n: {
    baseUrl: process.env.N8N_WEBHOOK_BASE_URL ?? "",
    collectWebhook: process.env.N8N_COLLECT_WEBHOOK ?? "",
    morningWebhook: process.env.N8N_MORNING_WEBHOOK ?? "",
    eveningWebhook: process.env.N8N_EVENING_WEBHOOK ?? "",
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
} as const;
