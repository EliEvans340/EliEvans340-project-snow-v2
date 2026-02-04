"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
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

// Cluster dot - size scales with count, no numbers
// If hasPopular is true, use purple color
function createClusterIcon(count: number, hasPopular: boolean = false) {
  // Scale from 14px (2 resorts) to 28px (50+ resorts)
  const minSize = 14;
  const maxSize = 28;
  const scale = Math.min(1, Math.log(count) / Math.log(50));
  const size = Math.round(minSize + (maxSize - minSize) * scale);

  const color = hasPopular ? "168, 85, 247" : "56, 232, 255"; // purple or ice blue

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

// Simple radar controller - creates layers and manages visibility
function RadarController({
  enabled,
  frames,
  currentIndex,
  opacity,
  onLoadingChange,
}: {
  enabled: boolean;
  frames: { time: number; url: string }[];
  currentIndex: number;
  opacity: number;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const map = useMap();
  const layersRef = useRef<Map<string, L.TileLayer>>(new Map());
  const loadedCountRef = useRef(0);
  const totalFramesRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      layersRef.current.forEach((layer) => {
        try { map.removeLayer(layer); } catch (e) { /* ignore */ }
      });
      layersRef.current.clear();
    };
  }, [map]);

  // Create all layers when frames change
  useEffect(() => {
    if (frames.length === 0) return;

    onLoadingChange?.(true);
    loadedCountRef.current = 0;
    totalFramesRef.current = frames.length;

    // Create layers for all frames
    frames.forEach((frame) => {
      if (!layersRef.current.has(frame.url)) {
        const layer = L.tileLayer(frame.url, {
          opacity: 0,
          zIndex: 100,
        });

        layer.on('load', () => {
          loadedCountRef.current++;
          if (loadedCountRef.current >= totalFramesRef.current) {
            onLoadingChange?.(false);
          }
        });

        layer.addTo(map);
        layersRef.current.set(frame.url, layer);

        // Trigger loading with tiny opacity
        layer.setOpacity(0.01);

        // Fallback: mark loaded after timeout
        setTimeout(() => {
          loadedCountRef.current++;
          if (loadedCountRef.current >= totalFramesRef.current) {
            onLoadingChange?.(false);
          }
        }, 5000);
      }
    });
  }, [map, frames, onLoadingChange]);

  // Update visibility based on current index
  useEffect(() => {
    const currentUrl = frames[currentIndex]?.url;

    layersRef.current.forEach((layer, url) => {
      const shouldShow = enabled && url === currentUrl;
      layer.setOpacity(shouldShow ? opacity : 0);
    });
  }, [enabled, frames, currentIndex, opacity]);

  return null;
}

// Signals when map is ready
function MapReadyHandler({ onReady }: { onReady: () => void }) {
  const map = useMap();
  useEffect(() => {
    onReady();
  }, [map, onReady]);
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

      // Cluster logic based on zoom level
      if (zoom >= 8) {
        // Show individual markers at high zoom
        onVisibleResortsChange(
          visibleResorts.map((r) => ({ type: "marker" as const, resort: r }))
        );
      } else {
        // Cluster markers at low zoom
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

  // Grid-based clustering - fine granularity for more dots
  // At zoom 4: ~1.5 degree cells (many regional dots)
  // At zoom 5: ~0.75 degree cells
  // At zoom 6: ~0.4 degree cells
  // At zoom 7: ~0.2 degree cells
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
      // Calculate center of cluster
      let sumLat = 0,
        sumLng = 0;
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

// Get unique states from resorts
function getUniqueStates(resorts: Resort[]): string[] {
  const states = new Set(resorts.map((r) => r.state));
  return Array.from(states).sort();
}

export default function ResortMap() {
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [resortsLoading, setResortsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [clusters, setClusters] = useState<ClusterOrMarker[]>([]);
  const [radarEnabled, setRadarEnabled] = useState(true);
  const [radarFrames, setRadarFrames] = useState<{ time: number; url: string }[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [radarLoading, setRadarLoading] = useState(true);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Fetch resorts - don't block initial render
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

  // Fetch radar frames AFTER map is ready (lazy load)
  useEffect(() => {
    if (!mapReady) return;

    async function fetchRadarFrames() {
      try {
        const response = await fetch("/api/radar");
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const frames: { time: number; url: string }[] = data.frames || [];

        if (frames.length === 0) {
          setRadarError("No radar data available yet");
          return;
        }

        setRadarFrames(frames);
        setCurrentFrameIndex(frames.length - 1);
        setRadarError(null);
      } catch (error) {
        console.error("Error fetching radar data:", error);
        setRadarError("Failed to load radar data");
      }
    }

    // Small delay to let map render first
    const timeout = setTimeout(fetchRadarFrames, 100);
    const interval = setInterval(fetchRadarFrames, 5 * 60 * 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [mapReady]);

  // Animation loop - only runs after all frames are loaded
  useEffect(() => {
    if (!isPlaying || radarFrames.length === 0 || radarLoading) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % radarFrames.length);
    }, 500); // Change frame every 500ms

    return () => clearInterval(interval);
  }, [isPlaying, radarFrames.length, radarLoading]);

  const currentFrame = radarFrames[currentFrameIndex];
  const currentTime = currentFrame ? new Date(currentFrame.time * 1000) : null;

  const states = useMemo(() => getUniqueStates(resorts), [resorts]);

  const filteredResorts = useMemo(() => {
    return resorts.filter((resort) => {
      const matchesSearch =
        searchQuery === "" ||
        resort.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesState =
        selectedState === "" || resort.state === selectedState;
      return matchesSearch && matchesState;
    });
  }, [resorts, searchQuery, selectedState]);

  // US center coordinates
  const center: [number, number] = [39.8283, -98.5795];

  return (
    <div className="h-screen w-full relative">
      <MapContainer
        center={center}
        zoom={4}
        className="h-full w-full"
        style={{ background: "#0f172a" }}
      >
        <MapReadyHandler onReady={() => setMapReady(true)} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {/* Weather Radar Controller - only load after map ready */}
        {mapReady && (
          <RadarController
            enabled={radarEnabled}
            frames={radarFrames}
            currentIndex={currentFrameIndex}
            opacity={0.7}
            onLoadingChange={setRadarLoading}
          />
        )}
        {/* Only render markers after resorts loaded */}
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
                  <div className="p-2">
                    <h3 className="font-bold text-lg text-snow-900">
                      {resort.name}
                    </h3>
                    <p className="text-snow-600">{resort.state}</p>
                    <Link
                      href={`/resort/${resort.slug}`}
                      className="inline-block mt-2 px-3 py-1 bg-ice-600 text-white rounded hover:bg-ice-700 transition-colors text-sm"
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
              <Marker
                key={`cluster-${index}`}
                position={[item.lat, item.lng]}
                icon={createClusterIcon(item.resorts.length, hasPopular)}
              >
                <Popup>
                  <div className="p-2 max-h-48 overflow-y-auto">
                    <h3 className="font-bold text-snow-900 mb-2">
                      {item.resorts.length} resorts
                    </h3>
                    <ul className="space-y-1">
                      {item.resorts.slice(0, 10).map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/resort/${r.slug}`}
                            className="text-ice-600 hover:text-ice-700 text-sm"
                          >
                            {r.name}
                          </Link>
                        </li>
                      ))}
                      {item.resorts.length > 10 && (
                        <li className="text-snow-500 text-sm">
                          +{item.resorts.length - 10} more
                        </li>
                      )}
                    </ul>
                  </div>
                </Popup>
              </Marker>
            );
          }
        })}
      </MapContainer>

      {/* Radar Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Radar Toggle */}
        <button
          onClick={() => setRadarEnabled(!radarEnabled)}
          className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
            radarEnabled
              ? "bg-ice-500/20 border-ice-500 text-ice-400"
              : "bg-snow-800/90 border-snow-600 text-snow-400"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Radar
        </button>

        {/* Radar Timeline Controls */}
        {radarEnabled && radarFrames.length > 0 && (
          <div className="bg-snow-800/95 backdrop-blur border border-snow-700 rounded-lg p-3 min-w-[280px]">
            {/* Loading indicator */}
            {radarLoading && (
              <div className="text-center mb-2 text-snow-400 text-xs flex items-center justify-center gap-2">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading radar...
              </div>
            )}
            {/* Error indicator */}
            {radarError && (
              <div className="text-center mb-2 text-red-400 text-xs">
                {radarError}
              </div>
            )}
            {/* Timestamp Display */}
            <div className="text-center mb-2">
              <span className="text-ice-400 text-sm font-medium">
                {currentTime?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="text-snow-500 text-xs ml-2">
                {currentTime?.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              </span>
              {currentFrameIndex === radarFrames.length - 1 && (
                <span className="text-green-400 text-xs ml-2">(now)</span>
              )}
            </div>

            {/* Timeline Slider */}
            <div className="flex items-center gap-2">
              {/* Play/Pause Button */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 rounded bg-snow-700 hover:bg-snow-600 text-snow-200 transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Slider */}
              <input
                type="range"
                min={0}
                max={radarFrames.length - 1}
                value={currentFrameIndex}
                onChange={(e) => {
                  setCurrentFrameIndex(parseInt(e.target.value));
                  setIsPlaying(false);
                }}
                className="flex-1 h-2 bg-snow-700 rounded-lg appearance-none cursor-pointer accent-ice-500"
              />
            </div>

            {/* Time labels */}
            <div className="flex justify-between mt-1 text-xs text-snow-500">
              <span>
                {radarFrames[0] && (() => {
                  const hoursAgo = Math.round((Date.now() / 1000 - radarFrames[0].time) / 3600);
                  return hoursAgo >= 1 ? `${hoursAgo}h ago` : "now";
                })()}
              </span>
              <span>now</span>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filter Dock */}
      <div className="absolute bottom-0 left-0 right-0 bg-snow-900/95 backdrop-blur border-t border-snow-700 p-4 z-[1000]">
        <div className="max-w-4xl mx-auto flex gap-4 items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search resorts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-snow-800 border border-snow-600 rounded-lg text-snow-100 placeholder-snow-500 focus:outline-none focus:border-ice-500 focus:ring-1 focus:ring-ice-500"
            />
          </div>
          <div className="w-48">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full px-4 py-2 bg-snow-800 border border-snow-600 rounded-lg text-snow-100 focus:outline-none focus:border-ice-500 focus:ring-1 focus:ring-ice-500"
            >
              <option value="">All States</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
          <div className="text-snow-400 text-sm whitespace-nowrap">
            {resortsLoading ? (
              <span className="flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </span>
            ) : (
              `${filteredResorts.length} resorts`
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
