import type { IntentSignal, IntentTier } from "@/types";

const BUYING_INTENT_KEYWORDS: Array<{
  keyword: string;
  weight: number;
  category: string;
}> = [
  { keyword: "looking for", weight: 12, category: "active-need" },
  { keyword: "need a tool", weight: 14, category: "active-need" },
  { keyword: "need help finding", weight: 13, category: "active-need" },
  { keyword: "recommend", weight: 10, category: "evaluation" },
  { keyword: "recommendation", weight: 10, category: "evaluation" },
  { keyword: "alternative to", weight: 12, category: "switching" },
  { keyword: "switching from", weight: 14, category: "switching" },
  { keyword: "best tool", weight: 11, category: "evaluation" },
  { keyword: "best software", weight: 11, category: "evaluation" },
  { keyword: "pricing", weight: 9, category: "budget" },
  { keyword: "budget", weight: 8, category: "budget" },
  { keyword: "hire", weight: 10, category: "hiring" },
  { keyword: "hiring", weight: 10, category: "hiring" },
  { keyword: "frustrated with", weight: 13, category: "pain-point" },
  { keyword: "anyone know", weight: 9, category: "active-need" },
  { keyword: "suggestions for", weight: 9, category: "evaluation" },
  { keyword: "trial", weight: 8, category: "evaluation" },
  { keyword: "demo", weight: 8, category: "evaluation" },
  { keyword: "b2b", weight: 7, category: "audience" },
  { keyword: "saas", weight: 9, category: "audience" },
  { keyword: "startup", weight: 8, category: "audience" },
  { keyword: "founder", weight: 9, category: "audience" },
  { keyword: "founders", weight: 9, category: "audience" },
  { keyword: "marketer", weight: 8, category: "audience" },
  { keyword: "marketing", weight: 7, category: "audience" },
  { keyword: "growth", weight: 8, category: "audience" },
  { keyword: "seo", weight: 8, category: "audience" },
  { keyword: "outreach", weight: 9, category: "audience" },
  { keyword: "link building", weight: 9, category: "audience" },
  { keyword: "product manager", weight: 8, category: "audience" },
  { keyword: "product management", weight: 8, category: "audience" },
  { keyword: "sales", weight: 7, category: "audience" },
  { keyword: "enterprise", weight: 8, category: "audience" },
  { keyword: "procurement", weight: 12, category: "budget" },
  { keyword: "vendor", weight: 10, category: "evaluation" },
  { keyword: "solution", weight: 6, category: "evaluation" },
  { keyword: "integrate", weight: 7, category: "technical" },
  { keyword: "api", weight: 6, category: "technical" },
  { keyword: "automation", weight: 7, category: "technical" },
  { keyword: "crm", weight: 8, category: "tools" },
  { keyword: "analytics", weight: 7, category: "tools" },
  { keyword: "customer acquisition", weight: 10, category: "audience" },
  { keyword: "lead gen", weight: 9, category: "audience" },
  { keyword: "collaborate", weight: 5, category: "community" },
  { keyword: "network", weight: 5, category: "community" },
  { keyword: "freelancer", weight: 7, category: "audience" },
  { keyword: "agency", weight: 8, category: "audience" },
  { keyword: "ecommerce", weight: 8, category: "audience" },
  { keyword: "shopify", weight: 8, category: "audience" },
  { keyword: "ai tool", weight: 10, category: "trending" },
  { keyword: "artificial intelligence", weight: 8, category: "trending" },
  { keyword: "machine learning", weight: 7, category: "trending" },
];

const HIGH_VALUE_CATEGORIES = [
  "saas",
  "startup",
  "marketing",
  "product",
  "business",
  "technology",
  "programming",
  "developer",
  "growth",
  "seo",
  "b2b",
  "entrepreneur",
  "founder",
  "sales",
  "data",
  "analytics",
  "fintech",
  "crypto",
  "ecommerce",
];

export function scoreIntentFromText(
  text: string,
  category?: string,
  tags: string[] = []
): { score: number; signals: IntentSignal[]; tier: IntentTier } {
  const normalized = text.toLowerCase();
  const signals: IntentSignal[] = [];
  let score = 0;

  for (const item of BUYING_INTENT_KEYWORDS) {
    if (normalized.includes(item.keyword)) {
      signals.push({
        keyword: item.keyword,
        weight: item.weight,
        category: item.category,
      });
      score += item.weight;
    }
  }

  const categoryText = [category, ...tags].filter(Boolean).join(" ").toLowerCase();
  for (const cat of HIGH_VALUE_CATEGORIES) {
    if (categoryText.includes(cat)) {
      score += 5;
      signals.push({ keyword: cat, weight: 5, category: "category-match" });
    }
  }

  // Cap and normalize to 0-100
  score = Math.min(100, Math.round(score * 0.85));

  const tier = scoreToTier(score);
  return { score, signals, tier };
}

export function scoreToTier(score: number): IntentTier {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  if (score >= 25) return "cool";
  return "cold";
}

export function computeMapPosition(
  intentScore: number,
  memberCount: number,
  platform: "discord" | "slack",
  index: number
): { x: number; y: number } {
  const x = intentScore + (platform === "slack" ? 2 : -2) + (Math.random() - 0.5) * 8;
  const logMembers = Math.log10(Math.max(memberCount, 10));
  const y = logMembers * 18 + (Math.random() - 0.5) * 6;
  const jitter = ((index % 7) - 3) * 1.5;
  return {
    x: Math.max(5, Math.min(95, x + jitter)),
    y: Math.max(10, Math.min(90, y)),
  };
}

export async function analyzeWithLLM(
  name: string,
  description: string,
  category?: string
): Promise<{ score: number; signals: IntentSignal[]; summary: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You analyze online community listings for B2B customer buying intent.
Return JSON: { "score": 0-100, "signals": [{"keyword": string, "weight": number, "category": string}], "summary": string }
Score based on: audience commercial value, pain points mentioned, evaluation/switching language, hiring/budget signals, and relevance for SaaS/B2B outreach.`,
        },
        {
          role: "user",
          content: `Community: ${name}\nCategory: ${category ?? "unknown"}\nDescription: ${description}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      score: number;
      signals: IntentSignal[];
      summary: string;
    };
    return {
      score: Math.min(100, Math.max(0, parsed.score)),
      signals: parsed.signals ?? [],
      summary: parsed.summary ?? "",
    };
  } catch {
    return null;
  }
}

export async function analyzeCommunityIntent(
  name: string,
  description: string,
  category?: string,
  tags: string[] = [],
  useLLM = true
): Promise<{
  score: number;
  signals: IntentSignal[];
  tier: IntentTier;
  method: "keyword" | "llm" | "hybrid";
}> {
  const keywordResult = scoreIntentFromText(
    `${name} ${description}`,
    category,
    tags
  );

  if (!useLLM || !process.env.OPENAI_API_KEY) {
    return { ...keywordResult, method: "keyword" };
  }

  const llmResult = await analyzeWithLLM(name, description, category);
  if (!llmResult) {
    return { ...keywordResult, method: "keyword" };
  }

  const hybridScore = Math.round(keywordResult.score * 0.4 + llmResult.score * 0.6);
  const mergedSignals = [...keywordResult.signals, ...llmResult.signals].slice(0, 12);

  return {
    score: hybridScore,
    signals: mergedSignals,
    tier: scoreToTier(hybridScore),
    method: "hybrid",
  };
}
