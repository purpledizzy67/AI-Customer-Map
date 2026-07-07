"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { Community, MapStats } from "@/types";
import type { EnrichedLead } from "@/lib/export-leads";
import { filterLeads } from "@/lib/export-leads";
import { IntentMap } from "@/components/IntentMap";
import { CommunityPanel } from "@/components/CommunityPanel";
import { CommunityList, StatsBar } from "@/components/CommunityList";
import { IntentExplainer } from "@/components/IntentExplainer";
import {
  Radar,
  RefreshCw,
  Map,
  Globe,
  AlertCircle,
  MapPin,
} from "lucide-react";
import clsx from "clsx";

const LeadsMap = dynamic(
  () => import("@/components/LeadsMap").then((m) => ({ default: m.LeadsMap })),
  { ssr: false, loading: () => (
    <div className="w-full h-full min-h-[500px] bg-[#e8e4df] flex items-center justify-center text-slate-500">
      Loading map...
    </div>
  )}
);

const WorldMap = dynamic(
  () => import("@/components/WorldMap").then((m) => ({ default: m.WorldMap })),
  { ssr: false }
);

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
  const [regionFilter, setRegionFilter] = useState("");
  const [minIntent, setMinIntent] = useState("any");
  const [maxIntent, setMaxIntent] = useState("any");
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [config, setConfig] = useState({ apify: false, openai: false, apollo: false });
  const [mapView, setMapView] = useState<"leads" | "world" | "intent">("leads");
  const [error, setError] = useState<string | null>(null);
  const [enrichedLeads, setEnrichedLeads] = useState<EnrichedLead[]>([]);

  const fetchCommunities = useCallback(async () => {
    const params = new URLSearchParams();
    if (platformFilter !== "all") params.set("platform", platformFilter);
    if (tierFilter !== "all") params.set("tier", tierFilter);
    if (search) params.set("search", search);

    const res = await fetch(`/api/communities?${params}`);
    if (!res.ok) throw new Error(`Failed to load communities (${res.status})`);
    const data = await res.json();
    setCommunities(data.communities ?? []);
    if (data.stats) setStats(data.stats);
    setError(null);
    return (data.communities ?? []) as Community[];
  }, [platformFilter, tierFilter, search]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/communities");
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        let list = (data.communities ?? []) as Community[];
        setCommunities(list);
        if (data.stats) setStats(data.stats);
        const statsRes = await fetch("/api/stats");
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (!cancelled) setConfig(statsData.config ?? { apify: false, openai: false, apollo: false });
        }
        if (list.length === 0) {
          await fetch("/api/seed", { method: "POST" });
          const retry = await fetch("/api/communities");
          if (retry.ok) {
            const retryData = await retry.json();
            if (!cancelled) {
              setCommunities(retryData.communities ?? []);
              if (retryData.stats) setStats(retryData.stats);
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (loading) return;
    fetchCommunities().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    });
  }, [platformFilter, tierFilter, search, loading, fetchCommunities]);

  const mapFiltered = useMemo(
    () =>
      filterLeads(communities, {
        region: regionFilter,
        minIntent,
        maxIntent,
        platform: platformFilter,
        tier: tierFilter,
        search,
      }),
    [communities, regionFilter, minIntent, maxIntent, platformFilter, tierFilter, search]
  );

  const selectedEnrichment = useMemo(
    () => enrichedLeads.find((e) => e.community.id === selected?.id),
    [enrichedLeads, selected?.id]
  );

  const handleScrape = async () => {
    setScraping(true);
    setWarnings([]);
    try {
      const keywordList = keywords.split(",").map((k) => k.trim()).filter(Boolean);
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
      setWarnings([err instanceof Error ? err.message : "Scrape failed"]);
    } finally {
      setScraping(false);
    }
  };

  const handleBulkEnrich = async () => {
    setBulkEnriching(true);
    try {
      const res = await fetch("/api/enrich/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityIds: mapFiltered.map((c) => c.id),
          limit: 30,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Bulk enrich failed");

      const leads: EnrichedLead[] = data.results.map(
        (r: {
          community: Community;
          enrichment: { organizations: EnrichedLead["organization"][]; domains: string[] };
        }) => ({
          community: r.community,
          organization: r.enrichment.organizations?.[0],
          domain: r.enrichment.domains?.[0],
        })
      );
      setEnrichedLeads((prev) => {
        const byId = new globalThis.Map(prev.map((l) => [l.community.id, l]));
        for (const lead of leads) byId.set(lead.community.id, lead);
        return [...byId.values()];
      });
      setWarnings([
        `Apollo enriched ${data.enriched} leads. Export CSV to use with Apollo extension on LinkedIn URLs.`,
      ]);
    } catch (err) {
      setWarnings([err instanceof Error ? err.message : "Bulk enrich failed"]);
    } finally {
      setBulkEnriching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="border-b border-white/10 bg-surface/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-intent to-accent-discord flex items-center justify-center">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">AI Customer Map</h1>
              <p className="text-xs text-slate-500">Live buying intent from Discord & Slack</p>
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
                scraping ? "bg-slate-700 text-slate-400" : "bg-accent-intent/20 text-accent-intent hover:bg-accent-intent/30"
              )}
            >
              <RefreshCw className={clsx("w-4 h-4", scraping && "animate-spin")} />
              {scraping ? "Scanning..." : "Discover"}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {config.apollo && (
              <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">Apollo</span>
            )}
            {config.apify && (
              <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">Apify</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="glass rounded-lg px-4 py-3 text-sm text-red-300/90 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="glass rounded-lg px-4 py-3 text-sm text-amber-300/90">
            {warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}

        <StatsBar stats={stats} />

        {loading ? (
          <div className="flex items-center justify-center h-96 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading leads map...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-200px)] min-h-[640px]">
            <div className="lg:col-span-3 h-full min-h-[300px] hidden lg:block">
              <CommunityList
                communities={mapFiltered}
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

            <div className="lg:col-span-6 h-full min-h-[500px] flex flex-col">
              <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                <button
                  onClick={() => setMapView("leads")}
                  className={clsx("px-2 py-1 rounded flex items-center gap-1", mapView === "leads" ? "bg-white/10 text-white" : "hover:text-white")}
                >
                  <MapPin className="w-3 h-3" /> Leads Map
                </button>
                <button
                  onClick={() => setMapView("world")}
                  className={clsx("px-2 py-1 rounded flex items-center gap-1", mapView === "world" ? "bg-white/10 text-white" : "hover:text-white")}
                >
                  <Globe className="w-3 h-3" /> World
                </button>
                <button
                  onClick={() => setMapView("intent")}
                  className={clsx("px-2 py-1 rounded flex items-center gap-1", mapView === "intent" ? "bg-white/10 text-white" : "hover:text-white")}
                >
                  <Map className="w-3 h-3" /> Intent
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {mapView === "leads" ? (
                  <LeadsMap
                    communities={mapFiltered}
                    selectedId={selected?.id}
                    onSelect={setSelected}
                    regionFilter={regionFilter}
                    onRegionFilterChange={setRegionFilter}
                    minIntent={minIntent}
                    maxIntent={maxIntent}
                    onMinIntentChange={setMinIntent}
                    onMaxIntentChange={setMaxIntent}
                    apolloConfigured={config.apollo}
                    enrichedLeads={enrichedLeads}
                    onBulkEnrich={handleBulkEnrich}
                    bulkEnriching={bulkEnriching}
                  />
                ) : mapView === "world" ? (
                  <WorldMap communities={mapFiltered} selectedId={selected?.id} onSelect={setSelected} />
                ) : (
                  <div className="glass rounded-xl h-full p-2">
                    <IntentMap communities={mapFiltered} selectedId={selected?.id} onSelect={setSelected} />
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 h-full min-h-[300px]">
              <CommunityPanel
                community={selected}
                onClose={() => setSelected(null)}
                apolloConfigured={config.apollo}
                prefilledEnrichment={selectedEnrichment}
              />
            </div>
          </div>
        )}

        <IntentExplainer />
      </main>
    </div>
  );
}
