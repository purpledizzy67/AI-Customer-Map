"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import type { Community } from "@/types";
import clsx from "clsx";

interface IntentMapProps {
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

function formatMembers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function IntentMap({ communities, selectedId, onSelect }: IntentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    community: Community;
  } | null>(null);

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

  const renderMap = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const margin = { top: 40, right: 24, bottom: 48, left: 56 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Grid
    g.append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(d3.range(0, 101, 20))
      .join("line")
      .attr("x1", (d) => (d / 100) * innerW)
      .attr("x2", (d) => (d / 100) * innerW)
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "#1e293b")
      .attr("stroke-dasharray", "2,4");

    g.append("g")
      .selectAll("line.h")
      .data(d3.range(0, 101, 20))
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => innerH - (d / 100) * innerH)
      .attr("y2", (d) => innerH - (d / 100) * innerH)
      .attr("stroke", "#1e293b")
      .attr("stroke-dasharray", "2,4");

    // Axes labels
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", "12px")
      .text("Buying Intent Score →");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", "12px")
      .text("Community Reach (members) →");

    // Intent zones
    const zones = [
      { x: 0, w: 0.25, label: "Cold", color: "#0f172a" },
      { x: 0.25, w: 0.2, label: "Cool", color: "#0c1a24" },
      { x: 0.45, w: 0.25, label: "Warm", color: "#1a1508" },
      { x: 0.7, w: 0.3, label: "Hot", color: "#1a0f08" },
    ];

    zones.forEach((zone) => {
      g.append("rect")
        .attr("x", zone.x * innerW)
        .attr("y", 0)
        .attr("width", zone.w * innerW)
        .attr("height", innerH)
        .attr("fill", zone.color)
        .attr("opacity", 0.5);

      g.append("text")
        .attr("x", (zone.x + zone.w / 2) * innerW)
        .attr("y", 14)
        .attr("text-anchor", "middle")
        .attr("fill", "#475569")
        .attr("font-size", "10px")
        .attr("font-weight", "600")
        .text(zone.label.toUpperCase());
    });

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

    const radiusScale = d3
      .scaleSqrt()
      .domain([0, d3.max(communities, (c) => c.memberCount) ?? 1000])
      .range([5, 22]);

    const nodes = communities.map((c) => ({
      ...c,
      fx: xScale(c.mapX),
      fy: yScale(c.mapY),
    }));

    const nodeGroup = g
      .selectAll<SVGGElement, (typeof nodes)[0]>(".node")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.fx},${d.fy})`)
      .style("cursor", "pointer");

    nodeGroup
      .append("circle")
      .attr("r", (d) => radiusScale(d.memberCount))
      .attr("fill", (d) => TIER_COLORS[d.intentTier])
      .attr("fill-opacity", (d) => (d.id === selectedId ? 0.95 : 0.65))
      .attr("stroke", (d) =>
        d.platform === "discord" ? "#5865f2" : "#e01e5a"
      )
      .attr("stroke-width", (d) => (d.id === selectedId ? 3 : 1.5))
      .attr("class", "transition-all duration-200");

    nodeGroup
      .filter((d) => d.id === selectedId)
      .append("circle")
      .attr("r", (d) => radiusScale(d.memberCount) + 6)
      .attr("fill", "none")
      .attr("stroke", TIER_COLORS.hot)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,2")
      .attr("opacity", 0.8);

    nodeGroup
      .on("mouseenter", function (event, d) {
        d3.select(this).select("circle").attr("fill-opacity", 0.95);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top - 10,
            community: d,
          });
        }
      })
      .on("mouseleave", function (_, d) {
        d3.select(this)
          .select("circle")
          .attr("fill-opacity", d.id === selectedId ? 0.95 : 0.65);
        setTooltip(null);
      })
      .on("click", (_, d) => {
        onSelect(d.id === selectedId ? null : d);
      });

    // Platform legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 140}, 12)`);

    [
      { label: "Discord", color: "#5865f2" },
      { label: "Slack", color: "#e01e5a" },
    ].forEach((item, i) => {
      legend
        .append("circle")
        .attr("cx", 0)
        .attr("cy", i * 18)
        .attr("r", 5)
        .attr("fill", "none")
        .attr("stroke", item.color)
        .attr("stroke-width", 2);
      legend
        .append("text")
        .attr("x", 12)
        .attr("y", i * 18 + 4)
        .attr("fill", "#94a3b8")
        .attr("font-size", "11px")
        .text(item.label);
    });
  }, [communities, dimensions, selectedId, onSelect]);

  useEffect(() => {
    renderMap();
  }, [renderMap]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      <svg ref={svgRef} className="w-full h-full" />
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none glass rounded-lg px-3 py-2 text-sm shadow-xl max-w-xs"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="font-semibold text-white">{tooltip.community.name}</div>
          <div className="text-xs text-slate-400 mt-0.5 flex gap-2">
            <span className={clsx("capitalize", `intent-${tooltip.community.intentTier}`)}>
              {tooltip.community.intentTier}
            </span>
            <span>·</span>
            <span>{tooltip.community.intentScore} intent</span>
            <span>·</span>
            <span>{formatMembers(tooltip.community.memberCount)} members</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 capitalize">
            {tooltip.community.platform}
          </div>
        </div>
      )}
    </div>
  );
}
