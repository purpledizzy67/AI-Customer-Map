import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db";
import { semanticSearch } from "@/workflows/semanticSearch";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }
  const results = await semanticSearch(DEMO_USER_ID, q.trim());
  return NextResponse.json({ results, query: q });
}
