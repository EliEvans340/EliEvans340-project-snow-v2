"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { useSession } from "next-auth/react";
import "leaflet/dist/leaflet.css";

interface Resort {
  id: string;
  name: string;
  slug: string;
  state: string;
  latitude: string | null;
  longitude: string | null;
}

// Custom marker icon (cyan for normal resorts)
const markerIcon = new L.Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338e8ff'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Favorite marker icon (gold star marker for favorite resorts)
const favoriteMarkerIcon = new L.Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fbbf24'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/%3E%3Cpath fill='%23ffffff' d='M12 5.5l1.12 2.27.5.1 2.5.2-1.9 1.63-.16.5.58 2.44-2.14-1.31-.5-.03-.5.03-2.14 1.31.58-2.44-.16-.5-1.9-1.63 2.5-.2.5-.1L12 5.5z'/%3E%3C/svg%3E",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

// Cluster icon
function createClusterIcon(count: number) {
  const size = count < 10 ? 40 : count < 100 ? 50 : 60;
  return L.divIcon({
    html: `<div style="
      background: rgba(56, 232, 255, 0.9);
      color: #0f172a;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: ${size / 3}px;
      border: 3px solid #0f172a;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${count}</div>`,
    className: "cluster-marker",
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
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

  // Grid-based clustering
  const gridSize = Math.pow(2, 10 - Math.min(zoom, 10));
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
  const { data: session } = useSession();
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [clusters, setClusters] = useState<ClusterOrMarker[]>([]);

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
        setLoading(false);
      }
    }
    fetchResorts();
  }, []);

  useEffect(() => {
    async function fetchFavorites() {
      if (!session) {
        setFavoriteIds(new Set());
        return;
      }
      try {
        const response = await fetch("/api/favorites");
        if (response.ok) {
          const data = await response.json();
          const ids = new Set<string>(
            data.map((f: { resortId: string }) => f.resortId)
          );
          setFavoriteIds(ids);
        }
      } catch (error) {
        console.error("Error fetching favorites:", error);
      }
    }
    fetchFavorites();
  }, [session]);

  const isFavorite = useCallback(
    (resortId: string) => favoriteIds.has(resortId),
    [favoriteIds]
  );

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

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-snow-900">
        <div className="text-ice-400 text-xl">Loading resorts...</div>
      </div>
    );
  }

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
        <MapBoundsHandler
          resorts={filteredResorts}
          onVisibleResortsChange={setClusters}
        />
        {clusters.map((item, index) => {
          if (item.type === "marker") {
            const resort = item.resort;
            if (!resort.latitude || !resort.longitude) return null;
            const isFav = isFavorite(resort.id);
            return (
              <Marker
                key={resort.id}
                position={[
                  parseFloat(resort.latitude),
                  parseFloat(resort.longitude),
                ]}
                icon={isFav ? favoriteMarkerIcon : markerIcon}
                zIndexOffset={isFav ? 1000 : 0}
              >
                <Popup className="resort-popup">
                  <div className="p-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-snow-900">
                        {resort.name}
                      </h3>
                      {isFav && (
                        <svg
                          className="w-4 h-4 fill-amber-500"
                          viewBox="0 0 24 24"
                        >
                          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      )}
                    </div>
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
            return (
              <Marker
                key={`cluster-${index}`}
                position={[item.lat, item.lng]}
                icon={createClusterIcon(item.resorts.length)}
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
            {filteredResorts.length} resorts
          </div>
        </div>
      </div>
    </div>
  );
}
