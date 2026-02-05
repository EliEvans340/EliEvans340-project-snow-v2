"use client";

import { useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ResortSkiMapProps {
  latitude: number;
  longitude: number;
  name: string;
}

const resortMarkerIcon = L.divIcon({
  html: `<div style="
    width: 14px;
    height: 14px;
    background: radial-gradient(circle, rgba(56, 232, 255, 1) 0%, rgba(56, 232, 255, 0.6) 50%, rgba(56, 232, 255, 0) 100%);
    border-radius: 50%;
    filter: blur(0.5px);
  "></div>`,
  className: "dot-marker",
  iconSize: L.point(14, 14),
  iconAnchor: L.point(7, 7),
});

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    let rafId: number;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try {
          if (map.getContainer()?.isConnected) {
            map.invalidateSize();
          }
        } catch {
          // Map may be unmounted
        }
      });
    });
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

function FitToSkiArea({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function fetchBounds() {
      try {
        const query = `[out:json];(way[landuse=winter_sports](around:5000,${latitude},${longitude});relation[landuse=winter_sports](around:5000,${latitude},${longitude}););out bb;`;
        const res = await fetch(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const data = await res.json();

        if (!mounted) return;

        if (data.elements?.length > 0) {
          let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
          for (const el of data.elements) {
            if (el.bounds) {
              minLat = Math.min(minLat, el.bounds.minlat);
              minLon = Math.min(minLon, el.bounds.minlon);
              maxLat = Math.max(maxLat, el.bounds.maxlat);
              maxLon = Math.max(maxLon, el.bounds.maxlon);
            }
          }
          if (minLat !== Infinity) {
            map.fitBounds(
              [[minLat, minLon], [maxLat, maxLon]],
              { padding: [20, 20] }
            );
          }
        }
      } catch {
        // Fallback: keep default center/zoom
      }
    }

    fetchBounds();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [map, latitude, longitude]);

  return null;
}

export default function ResortSkiMap({ latitude, longitude, name }: ResortSkiMapProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[9999] bg-snow-900"
          : "absolute inset-0"
      }
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        className="w-full h-full"
        style={{ background: "#0f172a" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxZoom={17}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.opensnowmap.org">OpenSnowMap</a> CC-BY-SA'
          url="https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png"
          opacity={1}
          zIndex={10}
        />
        <Marker
          position={[latitude, longitude]}
          icon={resortMarkerIcon}
        />
        <FitToSkiArea latitude={latitude} longitude={longitude} />
        <InvalidateOnResize />
      </MapContainer>

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-3 right-3 z-[10000] p-2 bg-snow-800/90 border border-snow-600 rounded-lg text-snow-200 hover:bg-snow-700 hover:text-snow-100 transition-colors"
        title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {fullscreen ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
        )}
      </button>
    </div>
  );
}
