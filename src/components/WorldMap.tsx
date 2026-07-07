"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Community } from "@/types";
import { communitiesToGeoPins, type GeoPin } from "@/lib/geo";
import clsx from "clsx";

interface WorldMapProps {
  communities: Community[];
  selectedId?: string | null;
  onSelect: (community: Community | null) => void;
}

const TIER_COLORS: Record<string, string> = {
  hot: "#f97316",
  warm: "#fbbf24",
  cool: "#22d3ee",
  cold: "#64748b",
};

const WORLD_ATLAS_URL = "/geo/countries-110m.json";

function pinRadius(memberCount: number, intentScore: number): number {
  const base = 4 + Math.sqrt(Math.max(memberCount, 1)) / 80;
  const intentBoost = intentScore >= 70 ? 2 : intentScore >= 45 ? 1 : 0;
  return Math.min(14, base + intentBoost);
}

export function WorldMap({ communities, selectedId, onSelect }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    pin: GeoPin;
  } | null>(null);
  const [worldLoaded, setWorldLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const geoDataRef = useRef<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width), height: Math.max(300, height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    d3.json(WORLD_ATLAS_URL)
      .then((topology) => {
        if (cancelled || !topology) return;
        const world = topology as Topology<{ countries: GeometryCollection }>;
        geoDataRef.current = feature(
          world,
          world.objects.countries
        ) as GeoJSON.FeatureCollection;
        setWorldLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Could not load map data. Try switching to Intent view.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const renderMap = useCallback(() => {
    if (!worldLoaded || !geoDataRef.current || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const pins = communitiesToGeoPins(communities);

    const projection = d3
      .geoNaturalEarth1()
      .fitSize([width, height], geoDataRef.current)
      .precision(0.1);

    const path = d3.geoPath().projection(projection);

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("class", "world-layer");

    // Ocean background
    svg
      .insert("rect", ":first-child")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#0c1220");

    // Countries
    g.selectAll("path.country")
      .data(geoDataRef.current.features)
      .join("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("fill", "#1a2332")
      .attr("stroke", "#2d3a4f")
      .attr("stroke-width", 0.4);

    // Graticule
    const graticule = d3.geoGraticule();
    g.append("path")
      .datum(graticule)
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 0.3)
      .attr("opacity", 0.5);

    const pinLayer = g.append("g").attr("class", "pins");

    const pinGroups = pinLayer
      .selectAll<SVGGElement, GeoPin>("g.pin")
      .data(pins, (d) => d.community.id)
      .join("g")
      .attr("class", "pin")
      .attr("transform", (d) => {
        const projected = projection(d.coordinates);
        if (!projected) return "translate(0,0)";
        return `translate(${projected[0]},${projected[1]})`;
      })
      .style("cursor", "pointer");

    // Selection ring
    pinGroups
      .filter((d) => d.community.id === selectedId)
      .append("circle")
      .attr("r", (d) => pinRadius(d.community.memberCount, d.community.intentScore) + 5)
      .attr("fill", "none")
      .attr("stroke", "#22d3ee")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "3,2")
      .attr("opacity", 0.9);

    // Pin marker
    pinGroups
      .append("circle")
      .attr("class", "pin-body")
      .attr("r", (d) => pinRadius(d.community.memberCount, d.community.intentScore))
      .attr("fill", (d) => TIER_COLORS[d.community.intentTier])
      .attr("fill-opacity", (d) => (d.community.id === selectedId ? 0.95 : 0.75))
      .attr("stroke", (d) =>
        d.community.platform === "discord" ? "#5865f2" : "#e01e5a"
      )
      .attr("stroke-width", (d) => (d.community.id === selectedId ? 2.5 : 1.5));

    // Pin point (map-marker style)
    pinGroups
      .append("circle")
      .attr("r", 2)
      .attr("cy", (d) => pinRadius(d.community.memberCount, d.community.intentScore) + 2)
      .attr("fill", (d) => TIER_COLORS[d.community.intentTier])
      .attr("opacity", 0.6);

    pinGroups
      .on("mouseenter", function (event, d) {
        d3.select(this).select(".pin-body").attr("fill-opacity", 1);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top - 10,
            pin: d,
          });
        }
      })
      .on("mouseleave", function (_, d) {
        d3.select(this)
          .select(".pin-body")
          .attr("fill-opacity", d.community.id === selectedId ? 0.95 : 0.75);
        setTooltip(null);
      })
      .on("click", (_, d) => {
        onSelect(d.community.id === selectedId ? null : d.community);
      });

    // Zoom & pan
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);
  }, [communities, dimensions, selectedId, onSelect, worldLoaded]);

  useEffect(() => {
    renderMap();
  }, [renderMap]);

  const resetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      <svg ref={svgRef} className="w-full h-full rounded-lg" />
      {!worldLoaded && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          Loading world map...
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
          {loadError}
        </div>
      )}
      <button
        onClick={resetZoom}
        className="absolute bottom-3 right-3 text-xs px-2.5 py-1.5 rounded-md glass text-slate-400 hover:text-white transition"
      >
        Reset view
      </button>
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none glass rounded-lg px-3 py-2 text-sm shadow-xl max-w-xs"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-semibold text-white">{tooltip.pin.community.name}</div>
          <div className="text-xs text-slate-400 mt-0.5 flex gap-2 flex-wrap">
            <span className={clsx("capitalize", `intent-${tooltip.pin.community.intentTier}`)}>
              {tooltip.pin.community.intentTier}
            </span>
            <span>·</span>
            <span>{tooltip.pin.community.intentScore} intent</span>
            <span>·</span>
            <span>{tooltip.pin.regionLabel}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Click pin to open details</div>
        </div>
      )}
      <div className="absolute top-3 left-3 flex flex-col gap-1 text-[10px] text-slate-500">
        {Object.entries(TIER_COLORS).map(([tier, color]) => (
          <div key={tier} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize">{tier}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
