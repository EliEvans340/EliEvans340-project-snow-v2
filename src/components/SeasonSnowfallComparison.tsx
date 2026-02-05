"use client";

import { useEffect, useState } from "react";

interface SeasonSnowfallData {
  currentSeason: {
    startDate: string;
    endDate: string;
    totalSnowfall: number;
    daysIntoSeason: number;
  };
  lastSeason: {
    startDate: string;
    endDate: string;
    totalSnowfall: number;
    fullSeasonTotal: number;
  };
  percentOfLastSeason: number;
}

interface SeasonSnowfallComparisonProps {
  slug: string;
}

export function SeasonSnowfallComparison({ slug }: SeasonSnowfallComparisonProps) {
  const [data, setData] = useState<SeasonSnowfallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/season-snowfall/${slug}`);
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError("Unable to load season data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="bg-snow-800 rounded-lg border border-snow-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <SnowflakeIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">Season Snowfall</h2>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-snow-700 rounded w-3/4"></div>
          <div className="h-8 bg-snow-700 rounded"></div>
          <div className="h-4 bg-snow-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const { currentSeason, lastSeason, percentOfLastSeason } = data;

  // Calculate progress towards last season's full total
  const progressTowardsFull =
    lastSeason.fullSeasonTotal > 0
      ? Math.min(100, (currentSeason.totalSnowfall / lastSeason.fullSeasonTotal) * 100)
      : 0;

  // Get season label (e.g., "2024-25")
  const currentSeasonLabel = `${currentSeason.startDate.slice(0, 4)}-${(
    parseInt(currentSeason.startDate.slice(0, 4)) + 1
  )
    .toString()
    .slice(2)}`;
  const lastSeasonLabel = `${lastSeason.startDate.slice(0, 4)}-${(
    parseInt(lastSeason.startDate.slice(0, 4)) + 1
  )
    .toString()
    .slice(2)}`;

  // Determine comparison status
  const comparison =
    percentOfLastSeason >= 110
      ? { label: "Above", color: "text-green-400", bgColor: "bg-green-500" }
      : percentOfLastSeason >= 90
        ? { label: "On Pace", color: "text-ice-400", bgColor: "bg-ice-500" }
        : { label: "Below", color: "text-amber-400", bgColor: "bg-amber-500" };

  return (
    <div className="bg-snow-800 rounded-lg border border-snow-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-snow-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SnowflakeIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">Season Snowfall</h2>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${comparison.bgColor}/20 ${comparison.color}`}>
          {comparison.label} vs Last Year
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Current Season Total */}
        <div className="text-center">
          <div className="text-4xl font-bold text-snow-100">
            {currentSeason.totalSnowfall}
            <span className="text-lg text-snow-400 ml-1">in</span>
          </div>
          <div className="text-sm text-snow-400 mt-1">
            {currentSeasonLabel} Season ({currentSeason.daysIntoSeason} days)
          </div>
        </div>

        {/* Progress Bar - Current vs Last Season at Same Point */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-snow-400">
            <span>vs. Last Season (same point)</span>
            <span className={comparison.color}>{percentOfLastSeason}%</span>
          </div>
          <div className="relative h-3 bg-snow-700 rounded-full overflow-hidden">
            {/* Last season marker at 100% */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-snow-500 z-10"
              style={{ left: "100%" }}
            />
            {/* Current season progress */}
            <div
              className={`h-full ${comparison.bgColor} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(100, percentOfLastSeason)}%` }}
            />
            {/* Overflow indicator if above 100% */}
            {percentOfLastSeason > 100 && (
              <div
                className="absolute top-0 bottom-0 bg-green-400/30 rounded-r-full"
                style={{
                  left: "100%",
                  width: `${Math.min(20, percentOfLastSeason - 100)}%`,
                }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-snow-500">0 in</span>
            <span className="text-snow-400">{lastSeason.totalSnowfall} in ({lastSeasonLabel})</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-snow-900/50 rounded-lg p-3 text-center">
            <div className="text-lg font-semibold text-snow-100">
              {lastSeason.totalSnowfall}
              <span className="text-xs text-snow-500 ml-1">in</span>
            </div>
            <div className="text-xs text-snow-400">{lastSeasonLabel} (to date)</div>
          </div>
          <div className="bg-snow-900/50 rounded-lg p-3 text-center">
            <div className="text-lg font-semibold text-snow-100">
              {lastSeason.fullSeasonTotal}
              <span className="text-xs text-snow-500 ml-1">in</span>
            </div>
            <div className="text-xs text-snow-400">{lastSeasonLabel} (full)</div>
          </div>
        </div>

        {/* Progress Towards Full Season */}
        <div className="pt-2 border-t border-snow-700">
          <div className="flex justify-between text-xs text-snow-400 mb-2">
            <span>Progress to {lastSeasonLabel} full season</span>
            <span>{Math.round(progressTowardsFull)}%</span>
          </div>
          <div className="h-2 bg-snow-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-ice-500/50 rounded-full transition-all duration-500"
              style={{ width: `${progressTowardsFull}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SnowflakeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2v4m0 12v4m-6.93-5.07l2.83-2.83m8.2-8.2l2.83-2.83M2 12h4m12 0h4M5.07 5.07l2.83 2.83m8.2 8.2l2.83 2.83M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}
