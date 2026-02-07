"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface CumulativePoint {
  dayOfSeason: number;
  cumulativeInches: number;
}

interface SeasonSnowfallData {
  currentSeason: {
    startDate: string;
    endDate: string;
    totalSnowfall: number;
    daysIntoSeason: number;
    daily: CumulativePoint[];
  };
  lastSeason: {
    startDate: string;
    endDate: string;
    totalSnowfall: number;
    fullSeasonTotal: number;
    dailyToDate: CumulativePoint[];
    dailyFull: CumulativePoint[];
  };
  percentOfLastSeason: number;
}

interface SeasonSnowfallComparisonProps {
  slug: string;
}

// Month tick positions: Nov 1 = day 0, Dec 1 = day 30, Jan 1 = day 61, etc.
const MONTH_TICKS = [0, 30, 61, 92, 120, 151, 181];
const MONTH_LABELS: Record<number, string> = {
  0: "Nov",
  30: "Dec",
  61: "Jan",
  92: "Feb",
  120: "Mar",
  151: "Apr",
  181: "",
};

// Merge current and last season data into a single array keyed by dayOfSeason
function useMergedChartData(data: SeasonSnowfallData | null) {
  return useMemo(() => {
    if (!data) return [];

    const map = new Map<
      number,
      { dayOfSeason: number; current?: number; lastSeason?: number }
    >();

    // Add last season (full) first — this gives the complete dashed line
    for (const pt of data.lastSeason.dailyFull) {
      map.set(pt.dayOfSeason, {
        dayOfSeason: pt.dayOfSeason,
        lastSeason: pt.cumulativeInches,
      });
    }

    // Overlay current season
    for (const pt of data.currentSeason.daily) {
      const existing = map.get(pt.dayOfSeason);
      if (existing) {
        existing.current = pt.cumulativeInches;
      } else {
        map.set(pt.dayOfSeason, {
          dayOfSeason: pt.dayOfSeason,
          current: pt.cumulativeInches,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => a.dayOfSeason - b.dayOfSeason
    );
  }, [data]);
}

function SnowRaceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | null;
    dataKey: string;
    color: string;
  }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;

  // Compute the date label from dayOfSeason
  const dayOfSeason = typeof label === "number" ? label : 0;
  const dateRef = new Date(new Date().getFullYear(), 10, 1); // Nov 1 as reference
  dateRef.setDate(dateRef.getDate() + dayOfSeason);
  const dateLabel = dateRef.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const currentEntry = payload.find((p) => p.dataKey === "current");
  const lastEntry = payload.find((p) => p.dataKey === "lastSeason");
  const currentVal =
    currentEntry?.value != null ? currentEntry.value : null;
  const lastVal = lastEntry?.value != null ? lastEntry.value : null;

  const delta =
    currentVal != null && lastVal != null ? currentVal - lastVal : null;

  return (
    <div className="bg-snow-800 border border-snow-600 rounded-lg p-3 shadow-lg min-w-[160px]">
      <p className="text-snow-200 font-medium mb-2 text-sm">{dateLabel}</p>
      {currentVal != null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-3 h-0.5 rounded bg-ice-400 inline-block" />
          <span className="text-snow-300">This Season:</span>
          <span className="text-snow-100 font-medium">
            {currentVal.toFixed(1)}&quot;
          </span>
        </div>
      )}
      {lastVal != null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-3 h-0.5 rounded bg-snow-500 inline-block border-t border-dashed border-snow-400" />
          <span className="text-snow-300">Last Season:</span>
          <span className="text-snow-100 font-medium">
            {lastVal.toFixed(1)}&quot;
          </span>
        </div>
      )}
      {delta != null && (
        <div className="mt-1.5 pt-1.5 border-t border-snow-700">
          <span
            className={`text-sm font-semibold ${delta >= 0 ? "text-green-400" : "text-amber-400"}`}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}&quot; {delta >= 0 ? "ahead" : "behind"}
          </span>
        </div>
      )}
    </div>
  );
}

export function SeasonSnowfallComparison({
  slug,
}: SeasonSnowfallComparisonProps) {
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
      } catch {
        setError("Unable to load season data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  const chartData = useMergedChartData(data);

  if (loading) {
    return (
      <div className="bg-snow-800 rounded-lg border border-snow-700">
        <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
          <SnowflakeIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">
            Season Snowfall
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-4 bg-snow-700 rounded w-3/4 animate-pulse" />
          <div className="h-[250px] bg-snow-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const { currentSeason, lastSeason, percentOfLastSeason } = data;

  // Comparison badge
  const diff = percentOfLastSeason - 100;
  const comparison =
    diff >= 10
      ? {
          label: `+${diff}% Above`,
          color: "text-green-400",
          bgColor: "bg-green-500",
        }
      : diff >= -10
        ? {
            label: "On Pace",
            color: "text-ice-400",
            bgColor: "bg-ice-500",
          }
        : {
            label: `${diff}% Below`,
            color: "text-amber-400",
            bgColor: "bg-amber-500",
          };

  // Season labels
  const currentSeasonLabel = `${currentSeason.startDate.slice(0, 4)}-${(
    parseInt(currentSeason.startDate.slice(0, 4)) + 1
  )
    .toString()
    .slice(2)}`;

  return (
    <div className="bg-snow-800 rounded-lg border border-snow-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-snow-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SnowflakeIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">
            Season Snowfall
          </h2>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${comparison.bgColor}/20 ${comparison.color}`}
        >
          {comparison.label}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Compact stats row */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-snow-100">
            {currentSeason.totalSnowfall}&quot;
          </span>
          <span className="text-sm text-snow-400">
            vs {lastSeason.totalSnowfall}&quot; last year (same point) &middot;{" "}
            {currentSeasonLabel}
          </span>
        </div>

        {/* Snow Race Chart */}
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="currentFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#67e8f9" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="lastFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6b7280" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#6b7280" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                vertical={false}
              />

              <XAxis
                dataKey="dayOfSeason"
                type="number"
                domain={[0, 181]}
                ticks={MONTH_TICKS}
                tickFormatter={(val: number) => MONTH_LABELS[val] ?? ""}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={{ stroke: "#4b5563" }}
                axisLine={{ stroke: "#4b5563" }}
              />

              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={{ stroke: "#4b5563" }}
                axisLine={{ stroke: "#4b5563" }}
                tickFormatter={(value: number) => `${value}"`}
                domain={[0, "auto"]}
                width={45}
              />

              <Tooltip
                content={<SnowRaceTooltip />}
                cursor={{ stroke: "#6b7280", strokeDasharray: "3 3" }}
              />

              {/* Today reference line */}
              <ReferenceLine
                x={currentSeason.daysIntoSeason}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                label={{
                  value: "Today",
                  fill: "#fbbf24",
                  fontSize: 11,
                  position: "top",
                }}
              />

              {/* Last season area (behind, rendered first) */}
              <Area
                type="monotone"
                dataKey="lastSeason"
                stroke="#6b7280"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                fill="url(#lastFill)"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />

              {/* Current season area (on top) */}
              <Area
                type="monotone"
                dataKey="current"
                stroke="#67e8f9"
                strokeWidth={2}
                fill="url(#currentFill)"
                dot={false}
                activeDot={{ r: 4, fill: "#67e8f9", stroke: "#1e3a5f" }}
                isAnimationActive={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-snow-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded bg-ice-400 inline-block" />
            <span>This Season</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded bg-snow-500 inline-block border-t border-dashed border-snow-400" />
            <span>Last Season</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-dashed border-amber-400 inline-block" />
            <span>Today</span>
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
