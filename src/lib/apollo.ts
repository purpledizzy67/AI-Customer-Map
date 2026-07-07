export interface ApolloOrganization {
  id?: string;
  name: string;
  domain: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  industry?: string;
  estimatedEmployees?: number;
  annualRevenue?: number;
  foundedYear?: number;
  city?: string;
  state?: string;
  country?: string;
  keywords?: string[];
  technologies?: string[];
  logoUrl?: string;
  shortDescription?: string;
}

export interface ApolloEnrichmentResult {
  communityId: string;
  domains: string[];
  organizations: ApolloOrganization[];
  enrichedAt: string;
  planNote?: string;
}

interface ApolloOrgResponse {
  organization?: {
    id?: string;
    name?: string;
    primary_domain?: string;
    website_url?: string;
    linkedin_url?: string;
    industry?: string;
    estimated_num_employees?: number;
    annual_revenue?: number;
    founded_year?: number;
    city?: string;
    state?: string;
    country?: string;
    keywords?: string[];
    current_technologies?: Array<{ name?: string }>;
    logo_url?: string;
    short_description?: string;
  };
}

const APOLLO_BASE = "https://api.apollo.io/api/v1";

export function extractDomains(...texts: (string | undefined)[]): string[] {
  const domains = new Set<string>();
  const skip = new Set([
    "discord.com",
    "discord.gg",
    "slack.com",
    "disboard.org",
    "slofile.com",
    "top.gg",
    "twitter.com",
    "x.com",
    "facebook.com",
    "linkedin.com",
    "youtube.com",
    "github.com",
    "google.com",
    "t.me",
  ]);

  for (const text of texts) {
    if (!text) continue;

    const urlMatches = text.matchAll(
      /https?:\/\/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi
    );
    for (const match of urlMatches) {
      const domain = match[1].toLowerCase();
      if (!skip.has(domain) && domain.includes(".")) domains.add(domain);
    }

    const bareMatches = text.matchAll(
      /\b([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|io|co|app|dev|ai|so|org|net))\b/gi
    );
    for (const match of bareMatches) {
      const domain = match[1].toLowerCase();
      if (!skip.has(domain)) domains.add(domain);
    }
  }

  return [...domains].slice(0, 5);
}

function normalizeOrg(
  org: NonNullable<ApolloOrgResponse["organization"]>,
  domain: string
): ApolloOrganization {
  return {
    id: org.id,
    name: org.name ?? domain,
    domain: org.primary_domain ?? domain,
    websiteUrl: org.website_url,
    linkedinUrl: org.linkedin_url,
    industry: org.industry,
    estimatedEmployees: org.estimated_num_employees,
    annualRevenue: org.annual_revenue,
    foundedYear: org.founded_year,
    city: org.city,
    state: org.state,
    country: org.country,
    keywords: org.keywords?.slice(0, 8),
    technologies: org.current_technologies
      ?.map((t) => t.name)
      .filter(Boolean) as string[] | undefined,
    logoUrl: org.logo_url,
    shortDescription: org.short_description,
  };
}

export async function enrichOrganizationByDomain(
  domain: string,
  apiKey: string
): Promise<ApolloOrganization | null> {
  const res = await fetch(
    `${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(domain)}`,
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      next: { revalidate: 0 },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`Apollo enrich failed for ${domain}:`, err);
    return null;
  }

  const data = (await res.json()) as ApolloOrgResponse;
  if (!data.organization?.name) return null;
  return normalizeOrg(data.organization, domain);
}

export async function enrichCommunityLeads(input: {
  communityId: string;
  name: string;
  description: string;
  tags: string[];
  websiteUrl?: string;
  inviteUrl?: string;
  sourceUrl?: string;
  apiKey: string;
}): Promise<ApolloEnrichmentResult> {
  const domains = extractDomains(
    input.websiteUrl,
    input.description,
    input.inviteUrl,
    input.sourceUrl,
    input.name
  );

  const organizations: ApolloOrganization[] = [];

  for (const domain of domains) {
    const org = await enrichOrganizationByDomain(domain, input.apiKey);
    if (org) organizations.push(org);
  }

  return {
    communityId: input.communityId,
    domains,
    organizations,
    enrichedAt: new Date().toISOString(),
    planNote:
      organizations.length === 0 && domains.length === 0
        ? "No company domain found. Add a website URL to the community listing, or paste a domain below."
        : organizations.length === 0
          ? "Domains found but Apollo returned no data. People search requires a paid Apollo plan."
          : undefined,
  };
}

export function isApolloConfigured(): boolean {
  return Boolean(process.env.APOLLO_API_KEY);
}

export type { ApolloPerson } from "@/types";

interface ApolloPersonResponse {
  person?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    title?: string;
    email?: string;
    linkedin_url?: string;
    city?: string;
    state?: string;
    country?: string;
    organization?: {
      name?: string;
      primary_domain?: string;
    };
  };
  error?: string;
  error_code?: string;
}

interface ApolloBulkPersonResponse {
  matches?: Array<{
    person?: ApolloPersonResponse["person"];
  }>;
  error?: string;
  error_code?: string;
}

function normalizePerson(
  person: NonNullable<ApolloPersonResponse["person"]>
): import("@/types").ApolloPerson {
  return {
    id: person.id,
    firstName: person.first_name,
    lastName: person.last_name,
    name: person.name,
    title: person.title,
    email: person.email,
    linkedinUrl: person.linkedin_url,
    city: person.city,
    state: person.state,
    country: person.country,
    organizationName: person.organization?.name,
    organizationDomain: person.organization?.primary_domain,
  };
}

export async function enrichPersonByName(
  firstName: string,
  lastName: string,
  domain: string,
  apiKey: string
): Promise<{ person: import("@/types").ApolloPerson | null; planBlocked?: boolean }> {
  const params = new URLSearchParams({
    first_name: firstName,
    last_name: lastName,
    domain,
  });

  const res = await fetch(`${APOLLO_BASE}/people/match?${params}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    next: { revalidate: 0 },
  });

  const data = (await res.json()) as ApolloPersonResponse;

  if (data.error_code === "API_INACCESSIBLE") {
    return { person: null, planBlocked: true };
  }

  if (!res.ok || !data.person?.id) {
    return { person: null };
  }

  return { person: normalizePerson(data.person) };
}

export async function enrichPeopleBulk(
  inputs: Array<{ firstName: string; lastName: string; domain: string }>,
  apiKey: string
): Promise<{
  results: Array<import("@/types").ApolloPerson | null>;
  planBlocked?: boolean;
}> {
  if (inputs.length === 0) return { results: [] };

  const res = await fetch(`${APOLLO_BASE}/people/bulk_match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      details: inputs.map((i) => ({
        first_name: i.firstName,
        last_name: i.lastName,
        domain: i.domain,
      })),
    }),
    next: { revalidate: 0 },
  });

  const data = (await res.json()) as ApolloBulkPersonResponse;

  if (data.error_code === "API_INACCESSIBLE") {
    return { results: inputs.map(() => null), planBlocked: true };
  }

  if (!res.ok) {
    return { results: inputs.map(() => null) };
  }

  const results = (data.matches ?? []).map((match) =>
    match.person?.id ? normalizePerson(match.person) : null
  );

  return { results };
}

/** Split a display name into first/last for Apollo lookup */
export function splitDisplayName(name: string): {
  firstName: string;
  lastName: string;
} {
  const cleaned = name.replace(/#\d+$/, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}
