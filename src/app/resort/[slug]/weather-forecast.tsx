"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
} from "recharts";

// ─── Interfaces ───────────────────────────────────────────────────

interface HourlyForecast {
  id: string;
  forecastTime: string;
  tempF: string | null;
  feelsLikeF: string | null;
  snowInches: string | null;
  precipInches: string | null;
  windMph: string | null;
  gustMph: string | null;
  humidityPct: number | null;
  conditions: string | null;
}

interface DailyForecast {
  id: string;
  forecastDate: string;
  highTempF: string | null;
  lowTempF: string | null;
  snowTotalInches: string | null;
  windAvgMph: string | null;
  conditionsSummary: string | null;
}

interface ForecastData {
  resort: { id: string; name: string; slug: string };
  snapshot: { id: string; model: string; fetchedAt: string; expiresAt: string };
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

interface WeatherForecastProps {
  slug: string;
}

interface HourlyDataPoint {
  time: string;
  tempF: number | null;
  feelsLikeF: number | null;
  snowInches: number | null;
  precipInches: number | null;
  windMph: number | null;
  gustMph: number | null;
  humidityPct: number | null;
  weatherCode: number | null;
  conditions: string;
  freezingLevelFt: number | null;
}

interface HourlyModelForecast {
  available: boolean;
  data: HourlyDataPoint[];
  error?: string;
}

interface MultiModelHourlyData {
  resort: { id: string; name: string; slug: string };
  models: {
    gfs: HourlyModelForecast;
    ecmwf: HourlyModelForecast;
    hrrr: HourlyModelForecast;
  };
  fetchedAt: string;
}

type ModelKey = "gfs" | "ecmwf" | "hrrr";

// ─── Timeline data types ──────────────────────────────────────────

interface TimelineRow {
  index: number;
  time: Date;
  label: string;
  isNow: boolean;
  isNight: boolean;
  isDayBoundary: boolean;
  dayLabel: string;
  tempF: number | null;
  feelsLikeF: number | null;
  snowInches: number;
  cumulativeSnow: number;
  windMph: number | null;
  gustMph: number | null;
  humidityPct: number | null;
  conditions: string;
}

// ─── Constants ────────────────────────────────────────────────────

const MODEL_TABS: { key: ModelKey; label: string; color: string; subtitle: string }[] = [
  { key: "hrrr", label: "HRRR", color: "text-green-400 border-green-400", subtitle: "48hr, 3km" },
  { key: "gfs", label: "GFS", color: "text-cyan-400 border-cyan-400", subtitle: "16-day, ~25km" },
  { key: "ecmwf", label: "ECMWF", color: "text-purple-400 border-purple-400", subtitle: "15-day, ~9km" },
];

const ROW_HEIGHT = 36;
const SYNC_ID = "hourly-timeline";

// ─── Hooks ────────────────────────────────────────────────────────

function useForecast(slug: string) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchForecast() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/forecast/${slug}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch forecast");
        }
        const forecastData = await res.json();
        setData(forecastData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load forecast");
      } finally {
        setLoading(false);
      }
    }
    fetchForecast();
  }, [slug]);

  return { data, loading, error };
}

function useMultiModelHourly(slug: string) {
  const [data, setData] = useState<MultiModelHourlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/hourly-forecast/${slug}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch hourly forecast");
        }
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load forecast");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  return { data, loading, error };
}

function useTimelineData(forecasts: HourlyDataPoint[]): TimelineRow[] {
  return useMemo(() => {
    if (!forecasts.length) return [];

    const now = new Date();
    let cumulativeSnow = 0;
    let prevDate = "";

    return forecasts.map((point, index) => {
      const time = new Date(point.time);
      const hour = time.getHours();
      const isNight = hour < 6 || hour >= 20;
      const snow = point.snowInches != null ? point.snowInches : 0;
      cumulativeSnow += snow;

      // Check if this is first entry of a new day
      const dateStr = time.toLocaleDateString();
      const isDayBoundary = dateStr !== prevDate;
      prevDate = dateStr;

      // "NOW" if this is the closest hour to current time
      const diffMs = Math.abs(time.getTime() - now.getTime());
      const isNow = index === 0 || diffMs < 30 * 60 * 1000;

      // Time label
      let label: string;
      if (isNow && index === 0) {
        label = "NOW";
      } else {
        label = time.toLocaleTimeString([], { hour: "numeric", hour12: true });
      }

      // Day label for boundary rows
      const dayLabel = time.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

      return {
        index,
        time,
        label,
        isNow: isNow && index === 0,
        isNight,
        isDayBoundary: isDayBoundary && index > 0,
        dayLabel,
        tempF: point.tempF,
        feelsLikeF: point.feelsLikeF,
        snowInches: snow,
        cumulativeSnow: Math.round(cumulativeSnow * 10) / 10,
        windMph: point.windMph,
        gustMph: point.gustMph,
        humidityPct: point.humidityPct,
        conditions: point.conditions || "Unknown",
      };
    });
  }, [forecasts]);
}

// ─── Daily Forecast Strip (unchanged) ─────────────────────────────

export function DailyForecastStrip({ slug }: WeatherForecastProps) {
  const { data, loading, error } = useForecast(slug);

  if (loading) {
    return (
      <section className="bg-snow-800 rounded-lg border border-snow-700">
        <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-ice-400" />
          <h2 className="text-lg font-semibold text-ice-400">10-Day Forecast</h2>
        </div>
        <div className="p-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-24 h-28 bg-snow-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || !data?.daily?.length) {
    return null;
  }

  return (
    <section className="bg-snow-800 rounded-lg border border-snow-700">
      <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
        <CalendarIcon className="w-5 h-5 text-ice-400" />
        <h2 className="text-lg font-semibold text-ice-400">10-Day Forecast</h2>
      </div>
      <div className="p-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {data.daily.slice(0, 10).map((forecast) => {
            const date = new Date(forecast.forecastDate + "T12:00:00");
            const high = forecast.highTempF ? Math.round(parseFloat(forecast.highTempF)) : "--";
            const low = forecast.lowTempF ? Math.round(parseFloat(forecast.lowTempF)) : "--";
            const snow = forecast.snowTotalInches ? parseFloat(forecast.snowTotalInches) : 0;
            const conditions = forecast.conditionsSummary || "Unknown";

            const isToday = new Date().toDateString() === date.toDateString();
            const dayLabel = isToday ? "Today" : date.toLocaleDateString([], { weekday: "short" });
            const dateLabel = date.toLocaleDateString([], { month: "short", day: "numeric" });

            return (
              <div
                key={forecast.id}
                className={`flex-shrink-0 w-24 p-3 rounded-lg border transition-colors ${
                  isToday
                    ? "bg-ice-500/10 border-ice-500/30"
                    : "bg-snow-900/50 border-snow-700 hover:border-snow-600"
                }`}
              >
                <div className="text-center">
                  <div className={`text-sm font-medium ${isToday ? "text-ice-400" : "text-snow-300"}`}>
                    {dayLabel}
                  </div>
                  <div className="text-xs text-snow-500 mb-2">{dateLabel}</div>
                  <div className="flex justify-center mb-2">
                    <WeatherIcon conditions={conditions} size="sm" />
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-lg font-semibold text-ice-300">{high}°</span>
                    <span className="text-sm text-snow-500">{low}°</span>
                  </div>
                  {snow > 0 && (
                    <div className="mt-1 text-xs text-ice-400 flex items-center justify-center gap-1">
                      <SnowflakeIcon className="w-3 h-3" />
                      {snow.toFixed(1)}&quot;
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-4 py-2 text-xs text-snow-500 border-t border-snow-700">
        Weather data: Open-Meteo
        {data?.snapshot && (
          <span className="ml-2">
            · Updated {new Date(data.snapshot.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </section>
  );
}

// ─── Hourly Forecast (main export) ────────────────────────────────

export function HourlyForecast({ slug }: WeatherForecastProps) {
  const { data, loading, error } = useMultiModelHourly(slug);
  const [activeModel, setActiveModel] = useState<ModelKey>("hrrr");

  useEffect(() => {
    if (!data) return;
    if (data.models.hrrr.available) {
      setActiveModel("hrrr");
    } else if (data.models.gfs.available) {
      setActiveModel("gfs");
    } else if (data.models.ecmwf.available) {
      setActiveModel("ecmwf");
    }
  }, [data]);

  return (
    <section className="bg-snow-800 rounded-lg border border-snow-700">
      <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
        <ClockIcon className="w-5 h-5 text-ice-400" />
        <h2 className="text-lg font-semibold text-ice-400">By the Hour</h2>
      </div>

      {/* Model tabs */}
      {!loading && !error && data && (
        <div className="px-4 pt-3 flex gap-2">
          {MODEL_TABS.map((tab) => {
            const model = data.models[tab.key];
            const isActive = activeModel === tab.key;
            const isAvailable = model.available;

            return (
              <button
                key={tab.key}
                onClick={() => isAvailable && setActiveModel(tab.key)}
                disabled={!isAvailable}
                className={`px-3 py-1.5 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? `${tab.color} bg-snow-900/50`
                    : isAvailable
                    ? "text-snow-400 border-transparent hover:text-snow-200 hover:bg-snow-900/30"
                    : "text-snow-600 border-transparent cursor-not-allowed"
                }`}
                title={!isAvailable ? `${tab.label} unavailable` : tab.subtitle}
              >
                {tab.label}
                {isActive && (
                  <span className="ml-1.5 text-xs text-snow-500 font-normal">{tab.subtitle}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4">
        {loading && <LoadingSkeleton />}
        {error && (
          <div className="text-center py-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {!loading && !error && data && (
          <HourlyTimelineChart
            forecasts={data.models[activeModel].data}
            fetchedAt={data.fetchedAt}
          />
        )}
      </div>
    </section>
  );
}

export const WeatherForecast = HourlyForecast;

// ─── Timeline Chart (replaces MultiModelHourlyView) ──────────────

function HourlyTimelineChart({
  forecasts,
  fetchedAt,
}: {
  forecasts: HourlyDataPoint[];
  fetchedAt: string;
}) {
  const rows = useTimelineData(forecasts);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeColRef = useRef<HTMLDivElement>(null);

  // Sync scroll between time column and chart panels
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (timeColRef.current && e.currentTarget !== timeColRef.current) {
      timeColRef.current.scrollTop = scrollTop;
    }
    if (scrollRef.current && e.currentTarget !== scrollRef.current) {
      scrollRef.current.scrollTop = scrollTop;
    }
  }, []);

  if (forecasts.length === 0) {
    return <p className="text-snow-400 text-center py-4">No hourly forecast data available</p>;
  }

  // Compute chart data for recharts (needs index as Y axis)
  const chartData = rows.map((row) => ({
    index: row.index,
    label: row.label,
    tempF: row.tempF,
    feelsLikeF: row.feelsLikeF,
    snowInches: row.snowInches > 0 ? row.snowInches : null,
    cumulativeSnow: row.cumulativeSnow,
    windMph: row.windMph,
    gustMph: row.gustMph,
    isNight: row.isNight,
    isNow: row.isNow,
  }));

  // Compute domains
  const temps = rows.filter((r) => r.tempF != null).map((r) => r.tempF!);
  const feelsTemps = rows.filter((r) => r.feelsLikeF != null).map((r) => r.feelsLikeF!);
  const allTemps = [...temps, ...feelsTemps];
  const tempMin = allTemps.length ? Math.floor(Math.min(...allTemps) / 5) * 5 - 5 : 0;
  const tempMax = allTemps.length ? Math.ceil(Math.max(...allTemps) / 5) * 5 + 5 : 50;

  const snowVals = rows.map((r) => r.snowInches).filter((v) => v > 0);
  const cumSnowMax = rows.length ? Math.max(...rows.map((r) => r.cumulativeSnow), 0.5) : 1;
  const snowMax = snowVals.length ? Math.max(Math.ceil(Math.max(...snowVals) * 2) / 2, 0.5) : 0.5;

  const winds = rows.filter((r) => r.windMph != null).map((r) => r.windMph!);
  const gusts = rows.filter((r) => r.gustMph != null).map((r) => r.gustMph!);
  const windMax = Math.max(...winds, ...gusts, 10);
  const windCeil = Math.ceil(windMax / 10) * 10 + 5;

  const totalHeight = rows.length * ROW_HEIGHT;
  const nowIndex = rows.findIndex((r) => r.isNow);

  // Night region boundaries for reference areas
  const nightRegions = getNightRegions(rows);

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden lg:block">
        <div className="flex gap-0 overflow-hidden rounded-lg border border-snow-700">
          {/* Time + Conditions Column */}
          <div
            ref={timeColRef}
            onScroll={handleScroll}
            className="w-[120px] flex-shrink-0 overflow-y-auto scrollbar-hide border-r border-snow-700"
            style={{ maxHeight: 480 }}
          >
            <TimeConditionsColumn
              rows={rows}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
            />
          </div>

          {/* Chart panels */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
            style={{ maxHeight: 480 }}
          >
            <div style={{ height: totalHeight, minHeight: totalHeight }} className="flex">
              {/* Temperature Panel */}
              <div className="flex-1 min-w-0 border-r border-snow-700/50 relative">
                <div className="sticky top-0 z-10 bg-snow-800/95 backdrop-blur-sm border-b border-snow-700/50 px-2 py-1">
                  <span className="text-xs font-medium text-snow-400">Temperature</span>
                </div>
                <div style={{ height: totalHeight }}>
                  <ResponsiveContainer width="100%" height={totalHeight}>
                    <AreaChart
                      data={chartData}
                      layout="vertical"
                      syncId={SYNC_ID}
                      margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                      onMouseMove={(state) => {
                        if (state?.activeTooltipIndex != null) {
                          setHoveredIndex(Number(state.activeTooltipIndex));
                        }
                      }}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#38e8ff" stopOpacity={0.05} />
                          <stop offset="100%" stopColor="#38e8ff" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[tempMin, tempMax]}
                        orientation="top"
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        unit="°"
                        hide
                      />
                      <YAxis type="category" dataKey="index" hide />
                      {/* Night bands */}
                      {nightRegions.map((region, i) => (
                        <ReferenceLine
                          key={`night-${i}`}
                          y={region.start}
                          stroke="transparent"
                        />
                      ))}
                      {/* Freezing reference line */}
                      <ReferenceLine
                        x={32}
                        stroke="#60a5fa"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        label={{ value: "32°F", position: "insideTopRight", fill: "#60a5fa", fontSize: 9 }}
                      />
                      {/* Now reference line */}
                      {nowIndex >= 0 && (
                        <ReferenceLine
                          y={nowIndex}
                          stroke="#38e8ff"
                          strokeWidth={2}
                          className="now-glow-line"
                        />
                      )}
                      <Tooltip
                        content={<CustomTimelineTooltip rows={rows} />}
                        cursor={{ stroke: "#38e8ff", strokeOpacity: 0.2, strokeWidth: ROW_HEIGHT }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tempF"
                        stroke="#38e8ff"
                        strokeWidth={2}
                        fill="url(#tempGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#38e8ff", stroke: "#0f172a", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="feelsLikeF"
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        fill="none"
                        dot={false}
                        activeDot={{ r: 3, fill: "#94a3b8", stroke: "#0f172a", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Snow Panel */}
              <div className="flex-1 min-w-0 border-r border-snow-700/50 relative">
                <div className="sticky top-0 z-10 bg-snow-800/95 backdrop-blur-sm border-b border-snow-700/50 px-2 py-1">
                  <span className="text-xs font-medium text-snow-400">Snow</span>
                </div>
                <div style={{ height: totalHeight }}>
                  <ResponsiveContainer width="100%" height={totalHeight}>
                    <ComposedChart
                      data={chartData}
                      layout="vertical"
                      syncId={SYNC_ID}
                      margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient id="snowBarGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#38e8ff" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#38e8ff" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, snowMax]}
                        orientation="top"
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        unit='"'
                        hide
                      />
                      <YAxis type="category" dataKey="index" hide />
                      {/* Cumulative snow axis (secondary) */}
                      <XAxis
                        type="number"
                        xAxisId="cumulative"
                        domain={[0, cumSnowMax]}
                        orientation="top"
                        hide
                      />
                      {nowIndex >= 0 && (
                        <ReferenceLine
                          y={nowIndex}
                          stroke="#38e8ff"
                          strokeWidth={2}
                          className="now-glow-line"
                        />
                      )}
                      <Bar
                        dataKey="snowInches"
                        fill="url(#snowBarGradient)"
                        radius={[0, 3, 3, 0]}
                        barSize={Math.min(ROW_HEIGHT - 8, 20)}
                        isAnimationActive={false}
                        className="snow-bar-shimmer"
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulativeSnow"
                        xAxisId="cumulative"
                        stroke="#7df2ff"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                        activeDot={{ r: 3, fill: "#7df2ff", stroke: "#0f172a", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Wind Panel */}
              <div className="flex-1 min-w-0 relative">
                <div className="sticky top-0 z-10 bg-snow-800/95 backdrop-blur-sm border-b border-snow-700/50 px-2 py-1">
                  <span className="text-xs font-medium text-snow-400">Wind</span>
                </div>
                <div style={{ height: totalHeight }}>
                  <ResponsiveContainer width="100%" height={totalHeight}>
                    <AreaChart
                      data={chartData}
                      layout="vertical"
                      syncId={SYNC_ID}
                      margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient id="windGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.05} />
                          <stop offset="40%" stopColor="#94a3b8" stopOpacity={0.15} />
                          <stop offset="70%" stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, windCeil]}
                        orientation="top"
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        unit=" mph"
                        hide
                      />
                      <YAxis type="category" dataKey="index" hide />
                      {nowIndex >= 0 && (
                        <ReferenceLine
                          y={nowIndex}
                          stroke="#38e8ff"
                          strokeWidth={2}
                          className="now-glow-line"
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="windMph"
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        fill="url(#windGradient)"
                        dot={false}
                        activeDot={{ r: 3, fill: "#94a3b8", stroke: "#0f172a", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="gustMph"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        fill="none"
                        dot={false}
                        activeDot={{ r: 3, fill: "#f59e0b", stroke: "#0f172a", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-snow-500 px-1">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-ice-400 inline-block" /> Temp
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-snow-400 inline-block border-dashed border-t border-snow-400" style={{ borderStyle: "dashed" }} /> Feels like
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "rgba(56,232,255,0.4)" }} /> Snow
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-snow-400 inline-block" /> Wind
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-amber-400 inline-block" style={{ borderStyle: "dashed" }} /> Gusts
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-blue-400 inline-block" style={{ borderStyle: "dashed" }} /> 32°F
          </span>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden">
        <MobileTimelineView rows={rows} chartData={chartData} nowIndex={nowIndex} tempMin={tempMin} tempMax={tempMax} snowMax={snowMax} cumSnowMax={cumSnowMax} windCeil={windCeil} />
      </div>

      <div className="mt-3 text-xs text-snow-500">
        Updated {new Date(fetchedAt).toLocaleTimeString()}
      </div>
    </>
  );
}

// ─── Time Conditions Column ───────────────────────────────────────

function TimeConditionsColumn({
  rows,
  hoveredIndex,
  onHover,
}: {
  rows: TimelineRow[];
  hoveredIndex: number | null;
  onHover: (i: number | null) => void;
}) {
  return (
    <div>
      {/* Header spacer to match chart header */}
      <div className="sticky top-0 z-10 bg-snow-800/95 backdrop-blur-sm border-b border-snow-700/50 px-2 py-1">
        <span className="text-xs font-medium text-snow-400">Time</span>
      </div>
      {rows.map((row) => (
        <div key={row.index}>
          {/* Day boundary divider */}
          {row.isDayBoundary && (
            <div className="px-2 py-1 bg-snow-900/80 border-y border-snow-700/50">
              <span className="text-[10px] font-medium text-ice-400/80 uppercase tracking-wide">
                {row.dayLabel}
              </span>
            </div>
          )}
          <div
            className={`flex items-center gap-1.5 px-2 transition-colors ${
              row.isNight ? "bg-snow-900/40" : row.index % 2 === 0 ? "bg-snow-900/15" : ""
            } ${hoveredIndex === row.index ? "bg-ice-500/10" : ""} ${
              row.isNow ? "border-l-2 border-ice-400" : ""
            }`}
            style={{ height: ROW_HEIGHT }}
            onMouseEnter={() => onHover(row.index)}
            onMouseLeave={() => onHover(null)}
          >
            <span
              className={`text-xs font-mono w-10 ${
                row.isNow ? "text-ice-400 font-bold" : "text-snow-400"
              }`}
            >
              {row.label}
            </span>
            <div className="w-5 h-5 flex-shrink-0">
              <WeatherIcon conditions={row.conditions} size="sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────

function CustomTimelineTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: number;
  payload?: unknown[];
  rows: TimelineRow[];
}) {
  if (!active || label == null) return null;

  const row = rows[label];
  if (!row) return null;

  return (
    <div className="bg-snow-900/95 backdrop-blur-sm border border-snow-600 rounded-lg px-3 py-2 shadow-xl text-xs min-w-[180px]">
      <div className="flex items-center gap-2 mb-1.5">
        <WeatherIcon conditions={row.conditions} size="sm" />
        <div>
          <div className="text-snow-200 font-medium">{row.label}</div>
          <div className="text-snow-500 capitalize">{row.conditions}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-snow-300">
        <span>Temp</span>
        <span className="text-ice-300 font-medium">{row.tempF != null ? `${Math.round(row.tempF)}°F` : "--"}</span>
        <span>Feels Like</span>
        <span className="text-snow-400">{row.feelsLikeF != null ? `${Math.round(row.feelsLikeF)}°F` : "--"}</span>
        <span>Snow</span>
        <span className="text-ice-300">
          {row.snowInches > 0 ? `${row.snowInches.toFixed(1)}"` : "--"}
        </span>
        <span>Accumulation</span>
        <span className="text-ice-200">{row.cumulativeSnow > 0 ? `${row.cumulativeSnow.toFixed(1)}"` : "--"}</span>
        <span>Wind</span>
        <span>{row.windMph != null ? `${Math.round(row.windMph)} mph` : "--"}</span>
        <span>Gusts</span>
        <span className="text-amber-400">{row.gustMph != null ? `${Math.round(row.gustMph)} mph` : "--"}</span>
        {row.humidityPct != null && (
          <>
            <span>Humidity</span>
            <span>{row.humidityPct}%</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Mobile Timeline View ─────────────────────────────────────────

type MobileDataType = "temp" | "snow" | "wind";

function MobileTimelineView({
  rows,
  chartData,
  nowIndex,
  tempMin,
  tempMax,
  snowMax,
  cumSnowMax,
  windCeil,
}: {
  rows: TimelineRow[];
  chartData: Record<string, unknown>[];
  nowIndex: number;
  tempMin: number;
  tempMax: number;
  snowMax: number;
  cumSnowMax: number;
  windCeil: number;
}) {
  const [activeType, setActiveType] = useState<MobileDataType>("temp");
  const totalHeight = Math.max(rows.length * ROW_HEIGHT, 300);

  const toggleBtns: { key: MobileDataType; label: string }[] = [
    { key: "temp", label: "Temp" },
    { key: "snow", label: "Snow" },
    { key: "wind", label: "Wind" },
  ];

  return (
    <div>
      {/* Toggle buttons */}
      <div className="flex gap-1 mb-3">
        {toggleBtns.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setActiveType(btn.key)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeType === btn.key
                ? "bg-ice-500/20 text-ice-400 border border-ice-500/30"
                : "bg-snow-900/50 text-snow-400 border border-snow-700 hover:text-snow-200"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Combined time + chart view */}
      <div className="overflow-y-auto scrollbar-hide rounded-lg border border-snow-700" style={{ maxHeight: 420 }}>
        <div className="flex">
          {/* Time labels */}
          <div className="w-[72px] flex-shrink-0 border-r border-snow-700/50">
            {rows.map((row) => (
              <div key={row.index}>
                {row.isDayBoundary && (
                  <div className="px-1.5 py-0.5 bg-snow-900/80 border-y border-snow-700/50">
                    <span className="text-[9px] font-medium text-ice-400/80 uppercase tracking-wide">
                      {row.time.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
                <div
                  className={`flex items-center gap-1 px-1.5 ${
                    row.isNight ? "bg-snow-900/40" : row.index % 2 === 0 ? "bg-snow-900/15" : ""
                  } ${row.isNow ? "border-l-2 border-ice-400" : ""}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className={`text-[10px] font-mono ${row.isNow ? "text-ice-400 font-bold" : "text-snow-400"}`}>
                    {row.label}
                  </span>
                  <div className="w-4 h-4 flex-shrink-0">
                    <WeatherIcon conditions={row.conditions} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="flex-1 min-w-0">
            <div style={{ height: totalHeight }}>
              <ResponsiveContainer width="100%" height={totalHeight}>
                {activeType === "temp" ? (
                  <AreaChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="mTempGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#38e8ff" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="#38e8ff" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} horizontal={false} />
                    <XAxis type="number" domain={[tempMin, tempMax]} hide />
                    <YAxis type="category" dataKey="index" hide />
                    <ReferenceLine x={32} stroke="#60a5fa" strokeDasharray="4 4" strokeOpacity={0.5} />
                    {nowIndex >= 0 && <ReferenceLine y={nowIndex} stroke="#38e8ff" strokeWidth={2} />}
                    <Tooltip content={<MobileTooltip rows={rows} dataType="temp" />} />
                    <Area type="monotone" dataKey="tempF" stroke="#38e8ff" strokeWidth={2} fill="url(#mTempGrad)" dot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="feelsLikeF" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" fill="none" dot={false} isAnimationActive={false} />
                  </AreaChart>
                ) : activeType === "snow" ? (
                  <ComposedChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="mSnowGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#38e8ff" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#38e8ff" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} horizontal={false} />
                    <XAxis type="number" domain={[0, snowMax]} hide />
                    <XAxis type="number" xAxisId="cumulative" domain={[0, cumSnowMax]} hide />
                    <YAxis type="category" dataKey="index" hide />
                    {nowIndex >= 0 && <ReferenceLine y={nowIndex} stroke="#38e8ff" strokeWidth={2} />}
                    <Bar dataKey="snowInches" fill="url(#mSnowGrad)" radius={[0, 3, 3, 0]} barSize={Math.min(ROW_HEIGHT - 8, 18)} isAnimationActive={false} />
                    <Line type="monotone" dataKey="cumulativeSnow" xAxisId="cumulative" stroke="#7df2ff" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  </ComposedChart>
                ) : (
                  <AreaChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="mWindGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.05} />
                        <stop offset="40%" stopColor="#94a3b8" stopOpacity={0.15} />
                        <stop offset="70%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} horizontal={false} />
                    <XAxis type="number" domain={[0, windCeil]} hide />
                    <YAxis type="category" dataKey="index" hide />
                    {nowIndex >= 0 && <ReferenceLine y={nowIndex} stroke="#38e8ff" strokeWidth={2} />}
                    <Tooltip content={<MobileTooltip rows={rows} dataType="wind" />} />
                    <Area type="monotone" dataKey="windMph" stroke="#94a3b8" strokeWidth={1.5} fill="url(#mWindGrad)" dot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="gustMph" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" fill="none" dot={false} isAnimationActive={false} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileTooltip({
  active,
  label,
  rows,
  dataType,
}: {
  active?: boolean;
  label?: number;
  payload?: unknown[];
  rows: TimelineRow[];
  dataType: MobileDataType;
}) {
  if (!active || label == null) return null;
  const row = rows[label];
  if (!row) return null;

  return (
    <div className="bg-snow-900/95 backdrop-blur-sm border border-snow-600 rounded-lg px-2.5 py-1.5 shadow-xl text-xs">
      <div className="text-snow-300 font-medium mb-0.5">{row.label}</div>
      {dataType === "temp" && (
        <div className="text-ice-300">
          {row.tempF != null ? `${Math.round(row.tempF)}°F` : "--"}
          {row.feelsLikeF != null && (
            <span className="text-snow-500 ml-1">(feels {Math.round(row.feelsLikeF)}°)</span>
          )}
        </div>
      )}
      {dataType === "snow" && (
        <div className="text-ice-300">
          {row.snowInches > 0 ? `${row.snowInches.toFixed(1)}"` : "No snow"}
          {row.cumulativeSnow > 0 && (
            <span className="text-snow-400 ml-1">({row.cumulativeSnow.toFixed(1)}&quot; total)</span>
          )}
        </div>
      )}
      {dataType === "wind" && (
        <div className="text-snow-300">
          {row.windMph != null ? `${Math.round(row.windMph)} mph` : "--"}
          {row.gustMph != null && (
            <span className="text-amber-400 ml-1">(gusts {Math.round(row.gustMph)})</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function getNightRegions(rows: TimelineRow[]): { start: number; end: number }[] {
  const regions: { start: number; end: number }[] = [];
  let regionStart: number | null = null;

  for (const row of rows) {
    if (row.isNight && regionStart === null) {
      regionStart = row.index;
    } else if (!row.isNight && regionStart !== null) {
      regions.push({ start: regionStart, end: row.index - 1 });
      regionStart = null;
    }
  }
  if (regionStart !== null) {
    regions.push({ start: regionStart, end: rows.length - 1 });
  }
  return regions;
}

// ─── Skeleton ─────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-16 h-4 bg-snow-700 rounded" />
          <div className="w-10 h-10 bg-snow-700 rounded" />
          <div className="flex-1">
            <div className="w-20 h-4 bg-snow-700 rounded mb-1" />
            <div className="w-28 h-3 bg-snow-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────

function SnowflakeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2v4m0 12v4m-6.93-5.07l2.83-2.83m8.2-8.2l2.83-2.83M2 12h4m12 0h4M5.07 5.07l2.83 2.83m8.2 8.2l2.83 2.83M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function WeatherIcon({ conditions, size = "md" }: { conditions: string; size?: "sm" | "md" }) {
  const lowerConditions = conditions.toLowerCase();
  const sizeClass = size === "sm" ? "w-6 h-6" : "w-8 h-8";

  if (lowerConditions.includes("snow") || lowerConditions.includes("blizzard")) {
    return (
      <svg className={`${sizeClass} text-ice-300`} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l1.09 3.41L16 4l-1.09 3.41L18 8.5l-3.09 1.09L16 12l-2.91-1.09L12 14l-1.09-3.09L8 12l1.09-2.91L6 8.5l3.09-1.09L8 4l2.91 1.41L12 2zm0 18l-1.09-3.41L8 18l1.09-3.41L6 13.5l3.09-1.09L8 10l2.91 1.09L12 8l1.09 3.09L16 10l-1.09 2.91L18 13.5l-3.09 1.09L16 18l-2.91-1.41L12 20z" />
      </svg>
    );
  }

  if (lowerConditions.includes("rain") || lowerConditions.includes("drizzle") || lowerConditions.includes("shower")) {
    return (
      <svg className={`${sizeClass} text-blue-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 16.9A5 5 0 0018 7h-1.26A8 8 0 103 14.25M12 14v8m-4-4v4m8-6v6" />
      </svg>
    );
  }

  if (lowerConditions.includes("cloud") || lowerConditions.includes("overcast")) {
    return (
      <svg className={`${sizeClass} text-snow-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    );
  }

  if (lowerConditions.includes("clear") || lowerConditions.includes("sunny") || lowerConditions.includes("fair")) {
    return (
      <svg className={`${sizeClass} text-yellow-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }

  if (lowerConditions.includes("fog") || lowerConditions.includes("mist") || lowerConditions.includes("haze")) {
    return (
      <svg className={`${sizeClass} text-snow-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 12h16M4 16h12" />
      </svg>
    );
  }

  return (
    <svg className={`${sizeClass} text-snow-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  );
}
