"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import type { Community } from "@/types";
import type { EnrichedLead } from "@/lib/export-leads";
import { communitiesToGeoPins } from "@/lib/geo";
import { downloadCsv } from "@/lib/export-leads";
import clsx from "clsx";
import { Download, Sparkles, Loader2 } from "lucide-react";

interface LeadsMapProps {
  communities: Community[];
  selectedId?: string | null;
  onSelect: (community: Community | null) => void;
  regionFilter: string;
  onRegionFilterChange: (v: string) => void;
  minIntent: string;
  maxIntent: string;
  onMinIntentChange: (v: string) => void;
  onMaxIntentChange: (v: string) => void;
  apolloConfigured?: boolean;
  enrichedLeads?: EnrichedLead[];
  onBulkEnrich?: () => Promise<void>;
  bulkEnriching?: boolean;
}

const TEARDROP_SVG = (color = "#3d3654", selected = false) => `
<svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">
  <path d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.925 17.075 0 11 0z"
    fill="${color}" stroke="${selected ? "#f59e0b" : "#2a2438"}" stroke-width="${selected ? 2.5 : 1.5}"/>
  <circle cx="11" cy="11" r="4" fill="white" fill-opacity="0.9"/>
</svg>`;

function makeIcon(selected: boolean) {
  return L.divIcon({
    className: "leads-pin-icon",
    html: TEARDROP_SVG("#3d3654", selected),
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    popupAnchor: [0, -28],
  });
}

function ClusterLayer({
  communities,
  selectedId,
  onSelect,
}: {
  communities: Community[];
  selectedId?: string | null;
  onSelect: (c: Community | null) => void;
}) {
  const map = useMap();
  const pins = useMemo(() => communitiesToGeoPins(communities), [communities]);

  useEffect(() => {
    const cluster = (
      L as typeof L & {
        markerClusterGroup: (options?: object) => L.LayerGroup & {
          addLayer: (layer: L.Layer) => void;
        };
      }
    ).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="cluster-bubble">${count}</div>`,
          className: "leads-cluster-icon",
          iconSize: [36, 36],
        });
      },
    });

    const markers: L.Marker[] = [];

    for (const pin of pins) {
      const [lng, lat] = pin.coordinates;
      const marker = L.marker([lat, lng], {
        icon: makeIcon(pin.community.id === selectedId),
      });
      marker.bindPopup(
        `<strong>${pin.community.name}</strong><br/>
         <span style="color:#666">${pin.community.intentScore} intent · ${pin.community.memberCount.toLocaleString()} members</span><br/>
         <span style="color:#999;font-size:11px">${pin.regionLabel}</span>`
      );
      marker.on("click", () => {
        onSelect(
          pin.community.id === selectedId ? null : pin.community
        );
      });
      markers.push(marker);
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [pins, map, onSelect, selectedId]);

  return null;
}

export function LeadsMap({
  communities,
  selectedId,
  onSelect,
  regionFilter,
  onRegionFilterChange,
  minIntent,
  maxIntent,
  onMinIntentChange,
  onMaxIntentChange,
  apolloConfigured,
  enrichedLeads = [],
  onBulkEnrich,
  bulkEnriching,
}: LeadsMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExport = useCallback(() => {
    const leads: EnrichedLead[] = communities.map((c) => {
      const enriched = enrichedLeads.find((e) => e.community.id === c.id);
      return enriched ?? { community: c };
    });
    downloadCsv(leads, `intentmap-${communities.length}-leads.csv`);
  }, [communities, enrichedLeads]);

  if (!mounted) {
    return (
      <div className="w-full h-full min-h-[500px] bg-[#e8e4df] flex items-center justify-center text-slate-500">
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-lg overflow-hidden border border-slate-200">
      {/* Top filter bar — matches reference style */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-end gap-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Region / City
          </label>
          <input
            type="text"
            value={regionFilter}
            onChange={(e) => onRegionFilterChange(e.target.value)}
            placeholder="e.g. North America, Miami"
            className="w-36 text-sm px-2 py-1.5 border border-slate-200 rounded bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Min Intent
          </label>
          <select
            value={minIntent}
            onChange={(e) => onMinIntentChange(e.target.value)}
            className="text-sm px-2 py-1.5 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="any">Any</option>
            <option value="25">25+</option>
            <option value="45">45+</option>
            <option value="70">70+ Hot</option>
          </select>
        </div>

        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Max Intent
          </label>
          <select
            value={maxIntent}
            onChange={(e) => onMaxIntentChange(e.target.value)}
            className="text-sm px-2 py-1.5 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="any">Any</option>
            <option value="100">100</option>
            <option value="69">69</option>
            <option value="44">44</option>
          </select>
        </div>

        <div className="flex-1 min-w-[120px] flex items-center px-2 py-1.5">
          <span className="text-sm font-medium text-slate-700">
            <span className="text-amber-600 font-bold">{communities.length}</span>{" "}
            leads match
          </span>
        </div>

        {apolloConfigured && onBulkEnrich && (
          <button
            onClick={onBulkEnrich}
            disabled={bulkEnriching || communities.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
          >
            {bulkEnriching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Enrich All
          </button>
        )}

        <button
          onClick={handleExport}
          disabled={communities.length === 0}
          className={clsx(
            "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition disabled:opacity-50",
            "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
          )}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Center overlay label */}
      <div className="absolute inset-0 z-[500] pointer-events-none flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-[2px] px-6 py-3 rounded-lg shadow-sm border border-white/60">
          <p className="text-sm font-bold text-slate-700 tracking-wide text-center uppercase">
            Every pin = community with buying intent
          </p>
          <p className="text-xs text-slate-500 text-center mt-1">
            Click a pin to view · Enrich all with Apollo · Export for outreach
          </p>
        </div>
      </div>

      <MapContainer
        center={[25.76, -80.19]}
        zoom={3}
        className="w-full h-full min-h-[500px]"
        zoomControl={false}
        style={{ background: "#e8e4df" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="bottomright" />
        <ClusterLayer
          communities={communities}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </MapContainer>

      <style jsx global>{`
        .leads-pin-icon {
          background: transparent !important;
          border: none !important;
        }
        .leads-cluster-icon {
          background: transparent !important;
          border: none !important;
        }
        .cluster-bubble {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #3d3654;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          border: 2px solid #2a2438;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
