"use client";

import { useState, useEffect, useCallback } from "react";
import type { Community, CommunityMember } from "@/types";
import type { ApolloEnrichmentResult } from "@/lib/apollo";
import type { EnrichedLead } from "@/lib/export-leads";
import { downloadMembersCsv } from "@/lib/export-members";
import clsx from "clsx";
import {
  ExternalLink,
  Users,
  Flame,
  MessageCircle,
  Hash,
  Sparkles,
  Building2,
  Globe,
  Loader2,
  Download,
  RefreshCw,
  UserCircle,
  AlertCircle,
} from "lucide-react";

interface CommunityPanelProps {
  community: Community | null;
  onClose: () => void;
  apolloConfigured?: boolean;
  prefilledEnrichment?: EnrichedLead;
}

function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    hot: "High Intent",
    warm: "Warm Lead",
    cool: "Moderate",
    cold: "Low Intent",
  };
  return labels[tier] ?? tier;
}

function formatRevenue(n?: number): string {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

export function CommunityPanel({
  community,
  onClose,
  apolloConfigured = false,
  prefilledEnrichment,
}: CommunityPanelProps) {
  const [enrichment, setEnrichment] = useState<ApolloEnrichmentResult | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [manualDomain, setManualDomain] = useState("");
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "members">("overview");
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [enrichingMembers, setEnrichingMembers] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberNote, setMemberNote] = useState<string | null>(null);
  const [memberDomain, setMemberDomain] = useState("");

  const loadMembers = useCallback(async (communityId: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/members?communityId=${encodeURIComponent(communityId)}`);
      const data = await res.json();
      if (data.success) setMembers(data.members ?? []);
    } catch {
      /* ignore */
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    setEnrichment(null);
    setEnrichError(null);
    setManualDomain("");
    setMemberError(null);
    setMemberNote(null);
    setMemberDomain("");
    setActiveTab("overview");
    setMembers([]);
    if (prefilledEnrichment?.organization && community) {
      setEnrichment({
        communityId: community.id,
        domains: prefilledEnrichment.domain ? [prefilledEnrichment.domain] : [],
        organizations: [prefilledEnrichment.organization],
        enrichedAt: new Date().toISOString(),
      });
    }
    if (community?.id) {
      loadMembers(community.id);
    }
  }, [community?.id, prefilledEnrichment, loadMembers]);

  const handleFetchMembers = async () => {
    if (!community) return;
    setFetchingMembers(true);
    setMemberError(null);
    setMemberNote(null);
    try {
      const res = await fetch("/api/members/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId: community.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to fetch members");
      }
      setMembers(data.members ?? []);
      if (data.limitation) setMemberNote(data.limitation);
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setFetchingMembers(false);
    }
  };

  const handleEnrichMembers = async () => {
    if (!community) return;
    setEnrichingMembers(true);
    setMemberError(null);
    try {
      const res = await fetch("/api/members/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId: community.id,
          domain: memberDomain || undefined,
          limit: 10,
        }),
      });
      const data = await res.json();
      if (data.planBlocked) {
        setMemberNote(data.error);
      } else if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Member enrichment failed");
      } else {
        if (data.planNote) setMemberNote(data.planNote);
        else if (data.enriched > 0) {
          setMemberNote(`Enriched ${data.enriched} of ${data.attempted} members via Apollo.`);
        }
      }
      await loadMembers(community.id);
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setEnrichingMembers(false);
    }
  };

  const handleEnrich = async (domain?: string) => {
    if (!community) return;
    setEnriching(true);
    setEnrichError(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId: community.id,
          domain: domain || manualDomain || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Enrichment failed");
      }
      setEnrichment(data.enrichment);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  if (!community) {
    return (
      <div className="glass rounded-xl p-6 h-full flex flex-col items-center justify-center text-center">
        <MessageCircle className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400 text-sm">
          Click a pin on the map to see intent signals, Apollo enrichment, and outreach links.
        </p>
      </div>
    );
  }

  const topSignals = community.intentSignals.slice(0, 6);

  return (
    <div className="glass rounded-xl overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-white/10 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={clsx(
                "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                community.platform === "discord"
                  ? "bg-accent-discord/20 text-accent-discord"
                  : "bg-accent-slack/20 text-accent-slack"
              )}
            >
              {community.platform}
            </span>
            <span
              className={clsx(
                "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                `intent-${community.intentTier}`
              )}
            >
              {tierLabel(community.intentTier)}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white mt-2">{community.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex border-b border-white/10">
        {(["overview", "members"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "flex-1 py-2.5 text-xs font-medium uppercase tracking-wide transition",
              activeTab === tab
                ? "text-white border-b-2 border-accent-intent"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {tab === "overview" ? "Overview" : `Members${members.length ? ` (${members.length})` : ""}`}
          </button>
        ))}
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {activeTab === "overview" ? (
          <>
        <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {community.memberCount.toLocaleString()} members
          </span>
          {community.category && (
            <span className="flex items-center gap-1">
              <Hash className="w-4 h-4" />
              {community.category}
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Intent Score</span>
            <span className="text-2xl font-bold text-accent-intent flex items-center gap-1">
              <Flame className="w-5 h-5 text-orange-400" />
              {community.intentScore}
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-amber-400 to-orange-500"
              style={{ width: `${community.intentScore}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">
          {community.description}
        </p>

        {topSignals.length > 0 && (
          <div>
            <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">
              Intent Signals
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {topSignals.map((signal, i) => (
                <span
                  key={`${signal.keyword}-${i}`}
                  className="text-xs px-2 py-1 rounded-md bg-surface-overlay text-slate-300"
                >
                  {signal.keyword}
                  <span className="text-slate-500 ml-1">+{signal.weight}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Apollo enrichment */}
        {apolloConfigured && (
          <div className="border border-white/10 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Apollo Lead Enrichment
              </h3>
              <button
                onClick={() => handleEnrich()}
                disabled={enriching}
                className="text-xs px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition disabled:opacity-50 flex items-center gap-1"
              >
                {enriching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Enrich
              </button>
            </div>

            {community.websiteUrl && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {community.websiteUrl}
              </p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={manualDomain}
                onChange={(e) => setManualDomain(e.target.value)}
                placeholder="company.com"
                className="flex-1 text-xs px-2 py-1.5 bg-surface/50 border border-white/10 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
              />
              <button
                onClick={() => handleEnrich(manualDomain)}
                disabled={enriching || !manualDomain.trim()}
                className="text-xs px-2 py-1.5 rounded-md border border-white/10 text-slate-400 hover:text-white disabled:opacity-40"
              >
                Go
              </button>
            </div>

            {enrichError && (
              <p className="text-xs text-red-400">{enrichError}</p>
            )}

            {enrichment?.planNote && enrichment.organizations.length === 0 && (
              <p className="text-xs text-amber-400/90">{enrichment.planNote}</p>
            )}

            {enrichment?.organizations.map((org) => (
              <div
                key={org.domain}
                className="bg-surface/50 rounded-lg p-3 space-y-2 border border-white/5"
              >
                <div className="flex items-start gap-2">
                  {org.logoUrl ? (
                    <img
                      src={org.logoUrl}
                      alt=""
                      className="w-8 h-8 rounded object-contain bg-white/10"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-purple-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white text-sm truncate">{org.name}</div>
                    <div className="text-xs text-slate-500">{org.domain}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-600">Employees</span>
                    <div className="text-slate-300">
                      {org.estimatedEmployees?.toLocaleString() ?? "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-600">Revenue</span>
                    <div className="text-slate-300">{formatRevenue(org.annualRevenue)}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-600">Industry</span>
                    <div className="text-slate-300 capitalize truncate">
                      {org.industry ?? "—"}
                    </div>
                  </div>
                </div>

                {org.keywords && org.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {org.keywords.slice(0, 5).map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  {org.websiteUrl && (
                    <a
                      href={org.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-0.5"
                    >
                      Website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {org.linkedinUrl && (
                    <a
                      href={org.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-0.5"
                    >
                      LinkedIn <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {community.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {community.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {(community.region || community.language) && (
          <p className="text-xs text-slate-500">
            {[community.region, community.language].filter(Boolean).join(" · ")}
          </p>
        )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-slate-500">
                Fetch individual members, then enrich via Apollo (paid plan) or export CSV.
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={handleFetchMembers}
                  disabled={fetchingMembers || !community.inviteUrl}
                  className="text-xs px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50 flex items-center gap-1"
                >
                  {fetchingMembers ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Fetch
                </button>
                {members.length > 0 && (
                  <button
                    onClick={() => downloadMembersCsv(members, community.name)}
                    className="text-xs px-2.5 py-1 rounded-md border border-white/10 text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </button>
                )}
              </div>
            </div>

            {apolloConfigured && members.length > 0 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={memberDomain}
                  onChange={(e) => setMemberDomain(e.target.value)}
                  placeholder="company.com for Apollo match"
                  className="flex-1 text-xs px-2 py-1.5 bg-surface/50 border border-white/10 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
                />
                <button
                  onClick={handleEnrichMembers}
                  disabled={enrichingMembers}
                  className="text-xs px-2.5 py-1.5 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition disabled:opacity-50 flex items-center gap-1"
                >
                  {enrichingMembers ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Enrich 10
                </button>
              </div>
            )}

            {memberError && (
              <p className="text-xs text-red-400 flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {memberError}
              </p>
            )}

            {memberNote && (
              <p className="text-xs text-amber-400/90 flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {memberNote}
              </p>
            )}

            {!community.inviteUrl && (
              <p className="text-xs text-slate-500">No invite URL available for this community.</p>
            )}

            {membersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No members fetched yet.</p>
                <p className="text-xs mt-1 text-slate-600">
                  Discord: widget shows online members. Add DISCORD_BOT_TOKEN for full roster.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-surface/40 border border-white/5"
                  >
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-slate-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">
                        {member.displayName ?? member.username}
                      </div>
                      <div className="text-[10px] text-slate-500 flex gap-2">
                        {member.status && (
                          <span className="capitalize">{member.status}</span>
                        )}
                        {member.activity && <span>{member.activity}</span>}
                        {member.role && <span>{member.role}</span>}
                      </div>
                      {member.apolloData && (
                        <div className="text-[10px] text-purple-300 truncate mt-0.5">
                          {member.apolloData.title && `${member.apolloData.title} · `}
                          {member.apolloData.organizationName ?? member.apolloData.name}
                          {member.apolloData.linkedinUrl && (
                            <a
                              href={member.apolloData.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 inline-flex items-center gap-0.5 hover:text-purple-200"
                            >
                              LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {member.apolloData && (
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10 space-y-2">
        {community.inviteUrl && (
          <a
            href={community.inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-accent-intent/20 text-accent-intent hover:bg-accent-intent/30 transition text-sm font-medium"
          >
            Join Community
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <a
          href={community.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition text-sm"
        >
          View on {community.platform === "discord" ? "Disboard" : "Slofile"}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
