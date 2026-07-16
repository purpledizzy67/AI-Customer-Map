"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OAuthAccount } from "@/types";

const PROVIDERS = [
  {
    id: "google",
    name: "Google",
    description: "Gmail + Calendar (read-only)",
  },
  { id: "slack", name: "Slack", description: "Mentions, unread, threads" },
  { id: "github", name: "GitHub", description: "PRs, reviews, issues, commits" },
  { id: "notion", name: "Notion", description: "Pages, tasks, databases" },
] as const;

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const [demoMode, setDemoMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/accounts");
    const json = (await res.json()) as {
      accounts: OAuthAccount[];
      demoMode: boolean;
    };
    setAccounts(json.accounts);
    setDemoMode(json.demoMode);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      setMessage(`Connected ${params.get("connected")}`);
    }
    if (params.get("error")) {
      setMessage(`Error: ${params.get("error")}`);
    }
  }, []);

  async function disconnect(provider: string) {
    await fetch("/api/auth/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="animate-fade-up">
        <p className="label">Settings</p>
        <h1 className="font-display text-3xl text-ink">Connections</h1>
        <p className="mt-2 text-sm text-ink-muted">
          OAuth tokens are encrypted at rest. Reconnect anytime if a token expires.
          {demoMode ? " Demo mode simulates connections without live OAuth apps." : null}
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
          {message}
        </div>
      ) : null}

      {loading ? (
        <p className="text-ink-muted">Loading accounts…</p>
      ) : (
        <ul className="space-y-3">
          {PROVIDERS.map((p) => {
            const account = accounts.find((a) => a.provider === p.id);
            const connected = account?.status === "connected";
            return (
              <li key={p.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink-muted">{p.description}</p>
                  {account?.accountEmail || account?.accountName ? (
                    <p className="mt-1 text-xs text-ink-faint">
                      {account.accountName ?? account.accountEmail}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      connected
                        ? "bg-signal-high/15 text-signal-high"
                        : "bg-canvas-overlay text-ink-faint"
                    }`}
                  >
                    {connected ? "Connected" : "Not connected"}
                  </span>
                  {connected ? (
                    <>
                      <Link
                        href={`/api/auth/connect/${p.id}?reconnect=1`}
                        className="rounded-md border border-canvas-border px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
                      >
                        Reconnect
                      </Link>
                      <button
                        type="button"
                        onClick={() => void disconnect(p.id)}
                        className="rounded-md border border-canvas-border px-3 py-1.5 text-xs text-signal-low"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <Link
                      href={`/api/auth/connect/${p.id}`}
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-canvas"
                    >
                      Connect
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="panel p-4 text-sm text-ink-muted">
        <p className="font-medium text-ink">Safety policy</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Never send emails automatically</li>
          <li>Never merge pull requests</li>
          <li>Never post Slack replies without approval</li>
        </ul>
      </div>
    </div>
  );
}
