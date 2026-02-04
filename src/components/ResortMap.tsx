"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

interface Resort {
  id: string;
  name: string;
  slug: string;
  state: string;
  latitude: string | null;
  longitude: string | null;
  terrainOpenPct: number | null;
  newSnow24h: number | null;
  snowDepthSummit: number | null;
  isOpen: number | null;
  conditions: string | null;
}

// Convert cm to inches
function cmToInches(cm: number | null): string {
  if (cm === null || cm === undefined) return "--";
  return Math.round(cm / 2.54).toString();
}

// Most popular US ski resorts (highlighted in purple)
const POPULAR_RESORTS = new Set([
  "vail", "park-city", "breckenridge", "aspen-snowmass", "aspen-mountain",
  "aspen-highlands", "buttermilk", "snowmass", "mammoth-mountain",
  "telluride", "steamboat", "jackson-hole", "big-sky", "deer-valley",
  "palisades-tahoe", "squaw-valley", "heavenly", "northstar",
  "killington", "stowe", "whistler-blackcomb", "copper-mountain",
  "keystone", "winter-park", "beaver-creek", "alta", "snowbird",
  "sun-valley", "taos", "big-bear", "mount-bachelor", "crystal-mountain",
]);

// Simple dot marker for individual resorts (ice blue)
const markerIcon = L.divIcon({
  html: `<div style="
    width: 10px;
    height: 10px;
    background: radial-gradient(circle, rgba(56, 232, 255, 1) 0%, rgba(56, 232, 255, 0.6) 50%, rgba(56, 232, 255, 0) 100%);
    border-radius: 50%;
    filter: blur(0.5px);
  "></div>`,
  className: "dot-marker",
  iconSize: L.point(10, 10),
  iconAnchor: L.point(5, 5),
  popupAnchor: [0, -5],
});

// Purple dot marker for popular resorts
const popularMarkerIcon = L.divIcon({
  html: `<div style="
    width: 12px;
    height: 12px;
    background: radial-gradient(circle, rgba(168, 85, 247, 1) 0%, rgba(168, 85, 247, 0.6) 50%, rgba(168, 85, 247, 0) 100%);
    border-radius: 50%;
    filter: blur(0.5px);
  "></div>`,
  className: "dot-marker popular",
  iconSize: L.point(12, 12),
  iconAnchor: L.point(6, 6),
  popupAnchor: [0, -6],
});

// Cluster dot - size scales with count
function createClusterIcon(count: number, hasPopular: boolean = false) {
  const minSize = 14;
  const maxSize = 28;
  const scale = Math.min(1, Math.log(count) / Math.log(50));
  const size = Math.round(minSize + (maxSize - minSize) * scale);

  const color = hasPopular ? "168, 85, 247" : "56, 232, 255";

  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: radial-gradient(circle, rgba(${color}, 0.9) 0%, rgba(${color}, 0.5) 60%, rgba(${color}, 0) 100%);
      border-radius: 50%;
      filter: blur(1px);
    "></div>`,
    className: "cluster-dot",
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
}

// Static radar layer - shows single frame
function StaticRadarLayer({
  enabled,
  url,
  opacity,
}: {
  enabled: boolean;
  url: string | null;
  opacity: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!url || !enabled) return;

    const layer = L.tileLayer(url, {
      opacity,
      zIndex: 100,
    });

    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, url, enabled, opacity]);

  return null;
}

// Map bounds handler for clustering
function MapBoundsHandler({
  resorts,
  onVisibleResortsChange,
}: {
  resorts: Resort[];
  onVisibleResortsChange: (clusters: ClusterOrMarker[]) => void;
}) {
  const map = useMap();

  useEffect(() => {
    function updateClusters() {
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      const visibleResorts = resorts.filter((r) => {
        if (!r.latitude || !r.longitude) return false;
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        return bounds.contains([lat, lng]);
      });

      if (zoom >= 8) {
        onVisibleResortsChange(
          visibleResorts.map((r) => ({ type: "marker" as const, resort: r }))
        );
      } else {
        const clusters = clusterResorts(visibleResorts, zoom);
        onVisibleResortsChange(clusters);
      }
    }

    map.on("moveend", updateClusters);
    map.on("zoomend", updateClusters);
    updateClusters();

    return () => {
      map.off("moveend", updateClusters);
      map.off("zoomend", updateClusters);
    };
  }, [map, resorts, onVisibleResortsChange]);

  return null;
}

type ClusterOrMarker =
  | { type: "marker"; resort: Resort }
  | { type: "cluster"; lat: number; lng: number; resorts: Resort[] };

function clusterResorts(resorts: Resort[], zoom: number): ClusterOrMarker[] {
  if (resorts.length === 0) return [];

  const gridSize = 1.5 / Math.pow(2, Math.max(0, zoom - 4));
  const clusters: Map<string, Resort[]> = new Map();

  resorts.forEach((resort) => {
    if (!resort.latitude || !resort.longitude) return;
    const lat = parseFloat(resort.latitude);
    const lng = parseFloat(resort.longitude);
    const cellX = Math.floor(lng / gridSize);
    const cellY = Math.floor(lat / gridSize);
    const key = `${cellX},${cellY}`;

    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key)!.push(resort);
  });

  const result: ClusterOrMarker[] = [];
  clusters.forEach((clusterResorts) => {
    if (clusterResorts.length === 1) {
      result.push({ type: "marker", resort: clusterResorts[0] });
    } else {
      let sumLat = 0, sumLng = 0;
      clusterResorts.forEach((r) => {
        sumLat += parseFloat(r.latitude!);
        sumLng += parseFloat(r.longitude!);
      });
      result.push({
        type: "cluster",
        lat: sumLat / clusterResorts.length,
        lng: sumLng / clusterResorts.length,
        resorts: clusterResorts,
      });
    }
  });

  return result;
}

function getUniqueStates(resorts: Resort[]): string[] {
  const states = new Set(resorts.map((r) => r.state));
  return Array.from(states).sort();
}

// Cluster marker that zooms in on click
function ClusterMarker({
  position,
  resorts,
  hasPopular,
}: {
  position: [number, number];
  resorts: Resort[];
  hasPopular: boolean;
}) {
  const map = useMap();

  const handleClick = useCallback(() => {
    // Calculate bounds that contain all resorts in the cluster
    const lats = resorts.map((r) => parseFloat(r.latitude!));
    const lngs = resorts.map((r) => parseFloat(r.longitude!));
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
    // Zoom to fit the cluster with some padding
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
  }, [map, resorts]);

  return (
    <Marker
      position={position}
      icon={createClusterIcon(resorts.length, hasPopular)}
      eventHandlers={{ click: handleClick }}
    />
  );
}

export default function ResortMap() {
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [resortsLoading, setResortsLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string>("");
  const [clusters, setClusters] = useState<ClusterOrMarker[]>([]);
  const [radarEnabled, setRadarEnabled] = useState(true);
  const [radarUrl, setRadarUrl] = useState<string | null>(null);
  const [radarTime, setRadarTime] = useState<Date | null>(null);

  // Fetch resorts
  useEffect(() => {
    async function fetchResorts() {
      try {
        const response = await fetch("/api/resorts");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setResorts(data);
      } catch (error) {
        console.error("Error fetching resorts:", error);
      } finally {
        setResortsLoading(false);
      }
    }
    fetchResorts();
  }, []);

  // Fetch latest radar frame
  useEffect(() => {
    async function fetchRadar() {
      try {
        const response = await fetch("/api/radar");
        const data = await response.json();

        if (data.error || !data.frames?.length) return;

        // Get the latest frame
        const latestFrame = data.frames[data.frames.length - 1];
        setRadarUrl(latestFrame.url);
        setRadarTime(new Date(latestFrame.time * 1000));
      } catch (error) {
        console.error("Error fetching radar:", error);
      }
    }

    fetchRadar();
    const interval = setInterval(fetchRadar, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const states = useMemo(() => getUniqueStates(resorts), [resorts]);

  const filteredResorts = useMemo(() => {
    return resorts.filter((resort) => {
      return selectedState === "" || resort.state === selectedState;
    });
  }, [resorts, selectedState]);

  const center: [number, number] = [39.8283, -98.5795];

  return (
    <div className="h-screen w-full relative">
      <MapContainer
        center={center}
        zoom={4}
        className="h-full w-full"
        style={{ background: "#0f172a" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Static Radar Layer */}
        <StaticRadarLayer
          enabled={radarEnabled}
          url={radarUrl}
          opacity={0.7}
        />

        {!resortsLoading && (
          <MapBoundsHandler
            resorts={filteredResorts}
            onVisibleResortsChange={setClusters}
          />
        )}

        {clusters.map((item, index) => {
          if (item.type === "marker") {
            const resort = item.resort;
            if (!resort.latitude || !resort.longitude) return null;
            const isPopular = POPULAR_RESORTS.has(resort.slug);
            return (
              <Marker
                key={resort.id}
                position={[
                  parseFloat(resort.latitude),
                  parseFloat(resort.longitude),
                ]}
                icon={isPopular ? popularMarkerIcon : markerIcon}
              >
                <Popup className="resort-popup">
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-bold text-lg text-snow-900">
                      {resort.name}
                    </h3>
                    <p className="text-snow-600 text-sm">{resort.state}</p>

                    {/* Conditions info */}
                    <div className="mt-2 space-y-1 text-sm">
                      {resort.isOpen !== null && (
                        <div className="flex items-center gap-1">
                          <span className={resort.isOpen ? "text-green-600" : "text-red-500"}>
                            {resort.isOpen ? "● Open" : "● Closed"}
                          </span>
                          {resort.terrainOpenPct !== null && resort.isOpen === 1 && (
                            <span className="text-snow-500">({resort.terrainOpenPct}% terrain)</span>
                          )}
                        </div>
                      )}
                      {resort.snowDepthSummit !== null && (
                        <div className="text-snow-700">
                          Base: {cmToInches(resort.snowDepthSummit)}&quot; at summit
                        </div>
                      )}
                      {resort.newSnow24h !== null && resort.newSnow24h > 0 && (
                        <div className="text-ice-600 font-medium">
                          +{cmToInches(resort.newSnow24h)}&quot; new snow
                        </div>
                      )}
                      {resort.conditions && (
                        <div className="text-snow-500 italic">{resort.conditions}</div>
                      )}
                    </div>

                    <Link
                      href={`/resort/${resort.slug}`}
                      className="inline-block mt-3 px-3 py-1 bg-ice-600 text-white rounded hover:bg-ice-700 transition-colors text-sm"
                    >
                      View details
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          } else {
            const hasPopular = item.resorts.some((r) => POPULAR_RESORTS.has(r.slug));
            return (
              <ClusterMarker
                key={`cluster-${index}`}
                position={[item.lat, item.lng]}
                resorts={item.resorts}
                hasPopular={hasPopular}
              />
            );
          }
        })}
      </MapContainer>

      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        {/* State Filter */}
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="px-3 py-1.5 bg-snow-800/90 border border-snow-600 rounded-lg text-snow-100 focus:outline-none focus:border-ice-500 text-sm"
        >
          <option value="">All States</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        {/* Radar Toggle */}
        <button
          onClick={() => setRadarEnabled(!radarEnabled)}
          className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 text-sm ${
            radarEnabled
              ? "bg-ice-500/20 border-ice-500 text-ice-400"
              : "bg-snow-800/90 border-snow-600 text-snow-400"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="hidden sm:inline">Radar</span>
        </button>
      </div>
    </div>
  );
}
