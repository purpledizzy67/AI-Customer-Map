"use client";

import { useState, type FormEvent } from "react";
import { useChat } from "@/hooks/useChat";
import { EvidenceList } from "@/components/ui/EvidenceList";
import { ConfidenceIndicator } from "@/components/ui/ConfidenceIndicator";

export default function ChatPage() {
  const { messages, loading, bootstrapping, send } = useChat();
  const [input, setInput] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input;
    setInput("");
    await send(msg);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 animate-fade-up">
        <p className="label">Chat</p>
        <h1 className="font-display text-3xl text-ink">What should I work on?</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Answers are grounded in your collected context and cite evidence. No hallucinations by policy.
        </p>
      </div>

      <div className="panel flex min-h-[55vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {bootstrapping ? (
            <p className="text-sm text-ink-muted">Loading conversation…</p>
          ) : null}
          {!bootstrapping && !messages.length ? (
            <div className="rounded-lg border border-dashed border-canvas-border p-6 text-center">
              <p className="text-sm text-ink-muted">
                Try: “What should I work on next?” or “Why is API documentation the priority?”
              </p>
            </div>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl px-4 py-3 ${
                m.role === "user"
                  ? "ml-8 bg-brand/15 text-ink"
                  : "mr-8 bg-canvas-overlay/80 text-ink"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              {m.role === "assistant" && m.confidence != null ? (
                <div className="mt-3 max-w-xs">
                  <ConfidenceIndicator value={m.confidence} />
                </div>
              ) : null}
              {m.evidence?.length ? (
                <div className="mt-3">
                  <p className="label mb-2">Evidence</p>
                  <EvidenceList evidence={m.evidence} />
                </div>
              ) : null}
            </div>
          ))}
          {loading ? (
            <p className="animate-pulse-soft text-sm text-ink-faint">Thinking with cited sources…</p>
          ) : null}
        </div>
        <form
          onSubmit={onSubmit}
          className="flex gap-2 border-t border-canvas-border p-3 sm:p-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about priorities, blockers, or next steps…"
            className="flex-1 rounded-lg border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
