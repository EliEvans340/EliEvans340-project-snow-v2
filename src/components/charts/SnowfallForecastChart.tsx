"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DailySnowfall {
  date: string;
  snowfallInches: number;
}

interface ModelForecast {
  available: boolean;
  data: DailySnowfall[];
  error?: string;
}

interface SnowfallChartData {
  resort: { id: string; name: string; slug: string };
  models: {
    gfs: ModelForecast;
    ecmwf: ModelForecast;
    hrrr: ModelForecast;
  };
  historical: DailySnowfall[];
  fetchedAt: string;
}

interface SnowfallForecastChartProps {
  slug: string;
}

// Hook to fetch chart data
function useSnowfallData(slug: string) {
  const [data, setData] = useState<SnowfallChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/snowfall-chart/${slug}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch chart data");
        }
        const chartData = await res.json();
        setData(chartData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chart");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  return { data, loading, error };
}

// Combine all data sources into a single chart dataset
function useChartData(data: SnowfallChartData | null) {
  return useMemo(() => {
    if (!data) return { chartData: [], todayIndex: -1 };

    const today = new Date().toISOString().split("T")[0];
    const allDates = new Set<string>();

    // Collect all dates
    data.historical.forEach((d) => allDates.add(d.date));
    if (data.models.gfs.available) {
      data.models.gfs.data.forEach((d) => allDates.add(d.date));
    }
    if (data.models.ecmwf.available) {
      data.models.ecmwf.data.forEach((d) => allDates.add(d.date));
    }
    if (data.models.hrrr.available) {
      data.models.hrrr.data.forEach((d) => allDates.add(d.date));
    }

    // Sort dates
    const sortedDates = Array.from(allDates).sort();

    // Create lookup maps
    const historicalMap = new Map(
      data.historical.map((d) => [d.date, d.snowfallInches])
    );
    const gfsMap = new Map(
      data.models.gfs.data.map((d) => [d.date, d.snowfallInches])
    );
    const ecmwfMap = new Map(
      data.models.ecmwf.data.map((d) => [d.date, d.snowfallInches])
    );
    const hrrrMap = new Map(
      data.models.hrrr.data.map((d) => [d.date, d.snowfallInches])
    );

    // Build chart data
    const chartData = sortedDates.map((date) => {
      const isHistorical = date < today;
      const dateObj = new Date(date + "T12:00:00");
      const label = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      return {
        date,
        label,
        historical: isHistorical ? historicalMap.get(date) ?? null : null,
        gfs: gfsMap.get(date) ?? null,
        ecmwf: ecmwfMap.get(date) ?? null,
        hrrr: hrrrMap.get(date) ?? null,
      };
    });

    const todayIndex = sortedDates.findIndex((d) => d === today);

    return { chartData, todayIndex };
  }, [data]);
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | null;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-snow-800 border border-snow-600 rounded-lg p-3 shadow-lg">
      <p className="text-snow-200 font-medium mb-2">{label}</p>
      {payload.map((entry, index) => {
        if (entry.value === null) return null;
        return (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-snow-300 capitalize">
              {entry.dataKey === "historical" ? "Actual" : entry.dataKey.toUpperCase()}:
            </span>
            <span className="text-snow-100 font-medium">
              {entry.value.toFixed(1)}&quot;
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Legend with toggles
function ChartLegend({
  visible,
  onToggle,
}: {
  visible: { historical: boolean; gfs: boolean; ecmwf: boolean; hrrr: boolean };
  onToggle: (key: keyof typeof visible) => void;
}) {
  const items: Array<{
    key: keyof typeof visible;
    label: string;
    color: string;
    type: "bar" | "line";
  }> = [
    { key: "historical", label: "Historical", color: "#6b7280", type: "bar" },
    { key: "gfs", label: "GFS", color: "#22d3ee", type: "line" },
    { key: "ecmwf", label: "ECMWF", color: "#a855f7", type: "line" },
    { key: "hrrr", label: "HRRR", color: "#22c55e", type: "line" },
  ];

  return (
    <div className="flex flex-wrap gap-3 justify-end">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onToggle(item.key)}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-opacity ${
            visible[item.key] ? "opacity-100" : "opacity-40"
          }`}
        >
          {item.type === "bar" ? (
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
          ) : (
            <span
              className="w-4 h-0.5 rounded"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className="text-snow-300">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SnowfallForecastChart({ slug }: SnowfallForecastChartProps) {
  const { data, loading, error } = useSnowfallData(slug);
  const { chartData, todayIndex } = useChartData(data);

  const [visible, setVisible] = useState({
    historical: true,
    gfs: true,
    ecmwf: true,
    hrrr: true,
  });

  const toggleVisibility = (key: keyof typeof visible) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <section className="bg-snow-800 rounded-lg border border-snow-700">
        <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
          <ChartIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">
            Snowfall Forecast
          </h2>
        </div>
        <div className="p-4">
          <div className="h-64 bg-snow-700 rounded-lg animate-pulse" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="bg-snow-800 rounded-lg border border-snow-700">
        <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
          <ChartIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">
            Snowfall Forecast
          </h2>
        </div>
        <div className="p-4 text-center text-snow-400">
          {error || "Unable to load forecast chart"}
        </div>
      </section>
    );
  }

  // Check if we have any data to display
  const hasData =
    chartData.length > 0 &&
    (data.historical.length > 0 ||
      data.models.gfs.available ||
      data.models.ecmwf.available ||
      data.models.hrrr.available);

  if (!hasData) {
    return (
      <section className="bg-snow-800 rounded-lg border border-snow-700">
        <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
          <ChartIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">
            Snowfall Forecast
          </h2>
        </div>
        <div className="p-4 text-center text-snow-400">
          No forecast data available
        </div>
      </section>
    );
  }

  return (
    <section className="bg-snow-800 rounded-lg border border-snow-700">
      <div className="px-4 py-3 border-b border-snow-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">
            Snowfall Forecast
          </h2>
        </div>
        <ChartLegend visible={visible} onToggle={toggleVisibility} />
      </div>
      <div className="p-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={{ stroke: "#4b5563" }}
                axisLine={{ stroke: "#4b5563" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={{ stroke: "#4b5563" }}
                axisLine={{ stroke: "#4b5563" }}
                tickFormatter={(value) => `${value}"`}
                domain={[0, "auto"]}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Today reference line */}
              {todayIndex >= 0 && (
                <ReferenceLine
                  x={chartData[todayIndex]?.label}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  label={{
                    value: "Today",
                    fill: "#fbbf24",
                    fontSize: 11,
                    position: "top",
                  }}
                />
              )}

              {/* Historical as bars */}
              {visible.historical && (
                <Bar
                  dataKey="historical"
                  fill="#6b7280"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                />
              )}

              {/* Model forecasts as lines */}
              {visible.gfs && (
                <Line
                  type="monotone"
                  dataKey="gfs"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={{ fill: "#22d3ee", r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              )}
              {visible.ecmwf && (
                <Line
                  type="monotone"
                  dataKey="ecmwf"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ fill: "#a855f7", r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              )}
              {visible.hrrr && (
                <Line
                  type="monotone"
                  dataKey="hrrr"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: "#22c55e", r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-snow-500">
          <span>GFS: 16-day forecast</span>
          <span>ECMWF: 15-day forecast</span>
          <span>HRRR: 48-hour high-res (US)</span>
        </div>
      </div>
      <div className="px-4 py-2 text-xs text-snow-500 border-t border-snow-700">
        Data: Open-Meteo
        {data.fetchedAt && (
          <span className="ml-2">
            · Updated {new Date(data.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </section>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16"
      />
    </svg>
  );
}
