"use client";

import { useCallback, useState } from "react";
import type { SearchResult } from "@/types";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results: SearchResult[] };
      setResults(json.results);
    } finally {
      setLoading(false);
    }
  }, []);

  return { query, results, loading, search, setQuery };
}
