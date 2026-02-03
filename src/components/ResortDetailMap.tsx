"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue with webpack
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface ResortDetailMapProps {
  latitude: number;
  longitude: number;
  name: string;
}

interface RainViewerData {
  radar: {
    past: { time: number; path: string }[];
    nowcast: { time: number; path: string }[];
  };
  host: string;
}

export default function ResortDetailMap({ latitude, longitude, name }: ResortDetailMapProps) {
  const [showRadar, setShowRadar] = useState(false);
  const [radarData, setRadarData] = useState<RainViewerData | null>(null);
  const [radarFrame, setRadarFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch radar data from RainViewer API
  useEffect(() => {
    if (!showRadar) return;

    const fetchRadarData = async () => {
      try {
        const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        const data: RainViewerData = await response.json();
        setRadarData(data);
        // Start at most recent frame
        setRadarFrame(data.radar.past.length - 1);
      } catch (error) {
        console.error("Failed to fetch radar data:", error);
      }
    };

    fetchRadarData();
    // Refresh radar data every 5 minutes
    const interval = setInterval(fetchRadarData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [showRadar]);

  // Animate through radar frames
  useEffect(() => {
    if (!isPlaying || !radarData) return;

    const totalFrames = radarData.radar.past.length + radarData.radar.nowcast.length;
    const interval = setInterval(() => {
      setRadarFrame((prev) => (prev + 1) % totalFrames);
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, radarData]);

  const getRadarTileUrl = () => {
    if (!radarData) return null;

    const allFrames = [...radarData.radar.past, ...radarData.radar.nowcast];
    const frame = allFrames[radarFrame];
    if (!frame) return null;

    return `${radarData.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
  };

  const getFrameTime = () => {
    if (!radarData) return "";

    const allFrames = [...radarData.radar.past, ...radarData.radar.nowcast];
    const frame = allFrames[radarFrame];
    if (!frame) return "";

    const date = new Date(frame.time * 1000);
    const isPast = radarFrame < radarData.radar.past.length;

    return `${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${isPast ? "" : " (forecast)"}`;
  };

  const radarUrl = getRadarTileUrl();

  return (
    <div className="relative h-full">
      <MapContainer
        center={[latitude, longitude]}
        zoom={9}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        {/* Base map layer - OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Radar overlay layer */}
        {showRadar && radarUrl && (
          <TileLayer
            url={radarUrl}
            opacity={0.6}
            attribution='Radar data: <a href="https://www.rainviewer.com/">RainViewer</a>'
          />
        )}

        {/* Resort marker */}
        <Marker position={[latitude, longitude]}>
          <Popup>{name}</Popup>
        </Marker>
      </MapContainer>

      {/* Radar Controls Overlay */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setShowRadar(!showRadar)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md shadow-md transition-colors ${
            showRadar
              ? "bg-ice-500 text-snow-900 hover:bg-ice-400"
              : "bg-snow-800 text-snow-200 hover:bg-snow-700 border border-snow-600"
          }`}
        >
          {showRadar ? "Radar On" : "Radar Off"}
        </button>
      </div>

      {/* Radar Timeline Controls */}
      {showRadar && radarData && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-snow-800/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-snow-600">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded bg-snow-700 hover:bg-snow-600 transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="w-4 h-4 text-ice-400" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-ice-400" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>

            <input
              type="range"
              min={0}
              max={radarData.radar.past.length + radarData.radar.nowcast.length - 1}
              value={radarFrame}
              onChange={(e) => setRadarFrame(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-snow-600 rounded-lg appearance-none cursor-pointer accent-ice-400"
            />

            <span className="text-xs text-snow-300 min-w-[90px] text-right">{getFrameTime()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
