import type { Community } from "@/types";
import type { ApolloOrganization } from "@/lib/apollo";

export interface EnrichedLead {
  community: Community;
  organization?: ApolloOrganization;
  domain?: string;
}

export function leadsToCsv(leads: EnrichedLead[]): string {
  const headers = [
    "Community Name",
    "Platform",
    "Intent Score",
    "Intent Tier",
    "Member Count",
    "Region",
    "Category",
    "Tags",
    "Company Name",
    "Domain",
    "Website",
    "LinkedIn URL",
    "Industry",
    "Employees",
    "Annual Revenue",
    "City",
    "State",
    "Country",
    "Community URL",
    "Invite URL",
    "Description",
  ];

  const rows = leads.map((lead) => {
    const c = lead.community;
    const o = lead.organization;
    return [
      c.name,
      c.platform,
      c.intentScore,
      c.intentTier,
      c.memberCount,
      c.region ?? "",
      c.category ?? "",
      c.tags.join("; "),
      o?.name ?? "",
      o?.domain ?? lead.domain ?? "",
      o?.websiteUrl ?? c.websiteUrl ?? "",
      o?.linkedinUrl ?? "",
      o?.industry ?? "",
      o?.estimatedEmployees ?? "",
      o?.annualRevenue ?? "",
      o?.city ?? "",
      o?.state ?? "",
      o?.country ?? "",
      c.sourceUrl,
      c.inviteUrl ?? "",
      c.description.replace(/"/g, '""'),
    ];
  });

  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join(
    "\n"
  );
}

export function downloadCsv(leads: EnrichedLead[], filename = "ai-customer-map-leads.csv") {
  const csv = leadsToCsv(leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function filterLeads(
  communities: Community[],
  filters: {
    region?: string;
    minIntent: string;
    maxIntent: string;
    platform?: string;
    tier?: string;
    search?: string;
  }
): Community[] {
  return communities.filter((c) => {
    if (filters.platform && filters.platform !== "all" && c.platform !== filters.platform) {
      return false;
    }
    if (filters.tier && filters.tier !== "all" && c.intentTier !== filters.tier) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${c.name} ${c.description} ${c.category ?? ""} ${c.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.region) {
      const q = filters.region.toLowerCase();
      const hay = `${c.region ?? ""} ${c.name} ${c.description} ${c.language ?? ""} ${c.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.minIntent !== "any") {
      const min = parseInt(filters.minIntent, 10);
      if (c.intentScore < min) return false;
    }
    if (filters.maxIntent !== "any") {
      const max = parseInt(filters.maxIntent, 10);
      if (c.intentScore > max) return false;
    }
    return true;
  });
}
