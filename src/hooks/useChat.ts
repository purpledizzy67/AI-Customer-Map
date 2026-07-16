"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const json = (await res.json()) as { messages: ChatMessage[] };
        setMessages(json.messages);
      }
      setBootstrapping(false);
    })();
  }, []);

  const send = useCallback(async (message: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { messages: ChatMessage[] };
      setMessages(json.messages);
    } finally {
      setLoading(false);
    }
  }, []);

  return { messages, loading, bootstrapping, send };
}
