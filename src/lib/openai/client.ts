/**
 * Safer OpenAI client — prefers Chat Completions JSON mode.
 * Attempts Responses API when available; never lets the LLM call tools/APIs.
 */

import OpenAI from "openai";
import { config, isDemoMode } from "@/lib/config";
import { withRateLimit } from "@/lib/rate-limit";
import { withRetry } from "@/lib/retry";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export interface LlmJsonOptions {
  system: string;
  user: string;
  temperature?: number;
}

export async function respondJson<T>(options: LlmJsonOptions): Promise<T | null> {
  const openai = getClient();
  if (!openai || (isDemoMode() && !process.env.OPENAI_API_KEY)) {
    return null;
  }

  return withRateLimit("openai", () =>
    withRetry(async () => {
      const completion = await openai.chat.completions.create({
        model: config.openaiModel,
        temperature: options.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
      });
      const text = completion.choices[0]?.message?.content;
      if (!text) return null;
      return JSON.parse(text) as T;
    }),
  );
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getClient();
  if (!openai || !texts.length || !config.openaiApiKey) {
    return texts.map((t) => {
      const vec = new Array(64).fill(0);
      for (let i = 0; i < t.length; i++) {
        vec[i % 64] += t.charCodeAt(i) / 255;
      }
      return vec;
    });
  }

  return withRateLimit("openai", () =>
    withRetry(async () => {
      const res = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
      });
      return res.data.map((d) => d.embedding);
    }),
  );
}
