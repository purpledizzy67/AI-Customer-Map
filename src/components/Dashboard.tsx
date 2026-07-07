"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Community, MapStats } from "@/types";
import { IntentMap } from "@/components/IntentMap";
import { WorldMap } from "@/components/WorldMap";
import { CommunityPanel } from "@/components/CommunityPanel";
import { CommunityList, StatsBar } from "@/components/CommunityList";
import { IntentExplainer } from "@/components/IntentExplainer";
import {
  Radar,
  RefreshCw,
  Zap,
  Map,
  Globe,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";

const DEFAULT_KEYWORDS = "saas,startup,marketing,seo,product";

export function Dashboard() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [stats, setStats] = useState<MapStats>({
    total: 0,
    hot: 0,
    warm: 0,
    cool: 0,
    cold: 0,
    discord: 0,
    slack: 0,
    avgIntent: 0,
  });
  const [selected, setSelected] = useState<Community | null>(null);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [config, setConfig] = useState({ apify: false, openai: false });
  const [mapView, setMapView] = useState<"world" | "intent">("world");

  const fetchCommunities = useCallback(async () => {
    const params = new URLSearchParams();
    if (platformFilter !== "all") params.set("platform", platformFilter);
    if (tierFilter !== "all") params.set("tier", tierFilter);
    if (search) params.set("search", search);

    const res = await fetch(`/api/communities?${params}`);
    const data = await res.json();
    setCommunities(data.communities);
    setStats(data.stats);
    return data.communities as Community[];
  }, [platformFilter, tierFilter, search]);

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await fetchCommunities();
      const statsRes = await fetch("/api/stats");
      const statsData = await statsRes.json();
      setConfig(statsData.config);

      if (existing.length === 0) {
        await fetch("/api/seed", { method: "POST" });
        await fetchCommunities();
      }
    } finally {
      setLoading(false);
    }
  }, [fetchCommunities]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!loading) {
      fetchCommunities();
    }
  }, [platformFilter, tierFilter, search, loading, fetchCommunities]);

  const handleScrape = async () => {
    setScraping(true);
    setWarnings([]);
    try {
      const keywordList = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: ["disboard", "slofile"],
          keywords: keywordList,
          maxPerSource: 30,
        }),
      });

      const data = await res.json();
      if (data.warnings?.length) setWarnings(data.warnings);
      await fetchCommunities();
    } catch (err) {
      setWarnings([
        err instanceof Error ? err.message : "Scrape failed",
      ]);
    } finally {
      setScraping(false);
    }
  };

  const filteredForMap = useMemo(() => communities, [communities]);

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      {/* Header */}
      <header className="border-b border-white/10 bg-surface/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-intent to-accent-discord flex items-center justify-center">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                IntentMap
              </h1>
              <p className="text-xs text-slate-500">
                Live buying intent from Discord & Slack
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-4">
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Keywords: saas, startup, marketing..."
              className="flex-1 text-sm px-3 py-2 bg-surface/50 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-intent/50"
            />
            <button
              onClick={handleScrape}
              disabled={scraping}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
                scraping
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-accent-intent/20 text-accent-intent hover:bg-accent-intent/30"
              )}
            >
              <RefreshCw
                className={clsx("w-4 h-4", scraping && "animate-spin")}
              />
              {scraping ? "Scanning..." : "Discover"}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {config.apify && (
              <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                Apify
              </span>
            )}
            {config.openai && (
              <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                AI
              </span>
            )}
            {!config.apify && (
              <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hidden sm:inline">
                Add APIFY_API_KEY
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">
        {warnings.length > 0 && (
          <div className="glass rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-amber-300/90">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <StatsBar stats={stats} />

        <IntentExplainer />

        {loading ? (
          <div className="flex items-center justify-center h-96 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading intent map...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[600px]">
            {/* Community list */}
            <div className="lg:col-span-3 h-full min-h-[300px]">
              <CommunityList
                communities={filteredForMap}
                selectedId={selected?.id}
                onSelect={setSelected}
                search={search}
                onSearchChange={setSearch}
                platformFilter={platformFilter}
                onPlatformChange={setPlatformFilter}
                tierFilter={tierFilter}
                onTierChange={setTierFilter}
              />
            </div>

            {/* Map */}
            <div className="lg:col-span-6 glass rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 text-sm text-slate-400">
                {mapView === "world" ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <Map className="w-4 h-4" />
                )}
                <span>{mapView === "world" ? "World Map" : "Intent Landscape"}</span>

                <div className="ml-3 flex rounded-lg border border-white/10 overflow-hidden text-xs">
                  <button
                    onClick={() => setMapView("world")}
                    className={clsx(
                      "px-3 py-1 flex items-center gap-1 transition",
                      mapView === "world"
                        ? "bg-accent-intent/20 text-accent-intent"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <Globe className="w-3 h-3" />
                    World
                  </button>
                  <button
                    onClick={() => setMapView("intent")}
                    className={clsx(
                      "px-3 py-1 flex items-center gap-1 transition",
                      mapView === "intent"
                        ? "bg-accent-intent/20 text-accent-intent"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <Map className="w-3 h-3" />
                    Intent
                  </button>
                </div>

                <span className="text-xs text-slate-600 ml-auto flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {filteredForMap.length} communities
                  {mapView === "world" && " · click pin to open"}
                </span>
              </div>
              <div className="flex-1 p-2">
                {mapView === "world" ? (
                  <WorldMap
                    communities={filteredForMap}
                    selectedId={selected?.id}
                    onSelect={setSelected}
                  />
                ) : (
                  <IntentMap
                    communities={filteredForMap}
                    selectedId={selected?.id}
                    onSelect={setSelected}
                  />
                )}
              </div>
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-3 h-full min-h-[300px]">
              <CommunityPanel
                community={selected}
                onClose={() => setSelected(null)}
              />
            </div>
          </div>
        )}

        {/* Mobile discover button */}
        <div className="md:hidden fixed bottom-4 right-4 left-4">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-intent text-surface font-semibold shadow-lg"
          >
            <RefreshCw className={clsx("w-5 h-5", scraping && "animate-spin")} />
            {scraping ? "Scanning communities..." : "Discover Communities"}
          </button>
        </div>
      </main>
    </div>
  );
}
