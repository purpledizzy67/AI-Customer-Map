import type { Community } from "@/types";

/** Region centroids [longitude, latitude] from Slofile + common labels */
const REGION_COORDS: Record<string, [number, number]> = {
  worldwide: [0, 20],
  global: [0, 20],
  international: [0, 20],
  "north america": [-98, 39],
  "south america": [-58, -15],
  europe: [10, 50],
  asia: [100, 34],
  africa: [20, 2],
  pacific: [135, -25],
  oceania: [135, -25],
  australia: [134, -25],
  "middle east": [45, 28],
  india: [78, 22],
  uk: [-2, 54],
  "united kingdom": [-2, 54],
  usa: [-98, 39],
  "united states": [-98, 39],
  canada: [-106, 56],
  germany: [10, 51],
  france: [2, 47],
  japan: [138, 36],
  china: [105, 35],
  brazil: [-52, -10],
  nigeria: [8, 10],
  singapore: [104, 1],
};

const LANGUAGE_COORDS: Record<string, [number, number]> = {
  english: [-30, 45],
  japanese: [138, 36],
  korean: [128, 36],
  chinese: [105, 35],
  german: [10, 51],
  french: [2, 47],
  spanish: [-4, 40],
  portuguese: [-8, 39],
  norwegian: [10, 62],
  russian: [100, 60],
  arabic: [45, 28],
  hindi: [78, 22],
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function jitterFromId(id: string, spread = 8): [number, number] {
  const h = hashId(id);
  const angle = (h % 360) * (Math.PI / 180);
  const dist = ((h % 100) / 100) * spread;
  return [Math.cos(angle) * dist, Math.sin(angle) * dist * 0.6];
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

function lookupRegion(region?: string): [number, number] | null {
  if (!region) return null;
  const key = normalizeKey(region);
  if (REGION_COORDS[key]) return REGION_COORDS[key];

  for (const [name, coords] of Object.entries(REGION_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

function lookupLanguage(language?: string): [number, number] | null {
  if (!language) return null;
  const key = normalizeKey(language);
  return LANGUAGE_COORDS[key] ?? null;
}

/** Infer region from tags/category for Discord communities missing Slofile region */
function inferFromTags(community: Community): [number, number] | null {
  const text = [community.category, ...community.tags, community.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("nyc") || text.includes("new york")) return [-74, 40];
  if (text.includes("india") || text.includes("hyderabad")) return [78, 22];
  if (text.includes("europe") || text.includes("berlin")) return [10, 50];
  if (text.includes("japan") || text.includes("tokyo")) return [139, 35];
  if (text.includes("uk") || text.includes("london")) return [-0.1, 51];
  if (text.includes("australia") || text.includes("sydney")) return [151, -33];
  return null;
}

export interface GeoPin {
  community: Community;
  coordinates: [number, number]; // [lng, lat]
  regionLabel: string;
}

export function getCommunityCoordinates(community: Community): GeoPin {
  const base =
    lookupRegion(community.region) ??
    lookupLanguage(community.language) ??
    inferFromTags(community) ??
    REGION_COORDS.worldwide;

  const [jx, jy] = jitterFromId(community.id);
  const coordinates: [number, number] = [base[0] + jx, base[1] + jy];

  const regionLabel =
    community.region ??
    community.language ??
    (community.platform === "discord" ? "Global (Discord)" : "Worldwide");

  return { community, coordinates, regionLabel };
}

export function communitiesToGeoPins(communities: Community[]): GeoPin[] {
  return communities.map(getCommunityCoordinates);
}
