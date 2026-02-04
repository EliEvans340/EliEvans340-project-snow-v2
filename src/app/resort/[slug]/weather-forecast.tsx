"use client";

import { useState, useEffect } from "react";

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

// Hook to fetch forecast data - shared between components
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

// Daily forecast horizontal strip - card style for main content
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
                      {snow.toFixed(1)}"
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

// Hourly forecast component - renamed from WeatherForecast
export function HourlyForecast({ slug }: WeatherForecastProps) {
  const { data, loading, error } = useForecast(slug);

  return (
    <section className="bg-snow-800 rounded-lg border border-snow-700">
      <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
        <ClockIcon className="w-5 h-5 text-ice-400" />
        <h2 className="text-lg font-semibold text-ice-400">By the Hour</h2>
      </div>

      <div className="p-4">
        {loading && <LoadingSkeleton />}
        {error && (
          <div className="text-center py-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {!loading && !error && data && <HourlyView forecasts={data.hourly} />}
      </div>
    </section>
  );
}

// Keep the old export name for backwards compatibility
export { HourlyForecast as WeatherForecast };

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

function HourlyView({ forecasts }: { forecasts: HourlyForecast[] }) {
  const next24Hours = forecasts.slice(0, 24);

  if (next24Hours.length === 0) {
    return <p className="text-snow-400 text-center py-4">No hourly forecast data available</p>;
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
      {next24Hours.map((forecast) => {
        const time = new Date(forecast.forecastTime);
        const temp = forecast.tempF ? Math.round(parseFloat(forecast.tempF)) : "--";
        const snow = forecast.snowInches ? parseFloat(forecast.snowInches).toFixed(1) : "0";
        const wind = forecast.windMph ? Math.round(parseFloat(forecast.windMph)) : "--";
        const conditions = forecast.conditions || "Unknown";

        return (
          <div
            key={forecast.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-snow-900/30 hover:bg-snow-900/50 transition-colors"
          >
            <div className="w-16 text-sm text-snow-400">
              {time.toLocaleTimeString([], { hour: "numeric", hour12: true })}
            </div>
            <div className="w-10 h-10 flex items-center justify-center">
              <WeatherIcon conditions={conditions} size="md" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-ice-300">{temp}°F</span>
                {parseFloat(snow) > 0 && (
                  <span className="text-sm text-ice-400 flex items-center gap-1">
                    <SnowflakeIcon className="w-3 h-3" />
                    {snow}"
                  </span>
                )}
              </div>
              <div className="text-xs text-snow-400 flex items-center gap-2">
                <span>{conditions}</span>
                <span className="flex items-center gap-1">
                  <WindIcon className="w-3 h-3" />
                  {wind} mph
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Icons
function SnowflakeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2v4m0 12v4m-6.93-5.07l2.83-2.83m8.2-8.2l2.83-2.83M2 12h4m12 0h4M5.07 5.07l2.83 2.83m8.2 8.2l2.83 2.83M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function WindIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5a2 2 0 012 2m-2-2a2 2 0 00-2 2m2-2V3m0 4H3m15 4a2 2 0 012 2m-2-2a2 2 0 00-2 2m2-2h-5m5 2h2m-9 4a2 2 0 012 2m-2-2a2 2 0 00-2 2m2-2H3m5 2H6" />
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

  // Snow conditions
  if (lowerConditions.includes("snow") || lowerConditions.includes("blizzard")) {
    return (
      <svg className={`${sizeClass} text-ice-300`} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l1.09 3.41L16 4l-1.09 3.41L18 8.5l-3.09 1.09L16 12l-2.91-1.09L12 14l-1.09-3.09L8 12l1.09-2.91L6 8.5l3.09-1.09L8 4l2.91 1.41L12 2zm0 18l-1.09-3.41L8 18l1.09-3.41L6 13.5l3.09-1.09L8 10l2.91 1.09L12 8l1.09 3.09L16 10l-1.09 2.91L18 13.5l-3.09 1.09L16 18l-2.91-1.41L12 20z" />
      </svg>
    );
  }

  // Rain
  if (lowerConditions.includes("rain") || lowerConditions.includes("drizzle") || lowerConditions.includes("shower")) {
    return (
      <svg className={`${sizeClass} text-blue-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 16.9A5 5 0 0018 7h-1.26A8 8 0 103 14.25M12 14v8m-4-4v4m8-6v6" />
      </svg>
    );
  }

  // Cloudy
  if (lowerConditions.includes("cloud") || lowerConditions.includes("overcast")) {
    return (
      <svg className={`${sizeClass} text-snow-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    );
  }

  // Clear/Sunny
  if (lowerConditions.includes("clear") || lowerConditions.includes("sunny") || lowerConditions.includes("fair")) {
    return (
      <svg className={`${sizeClass} text-yellow-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }

  // Fog
  if (lowerConditions.includes("fog") || lowerConditions.includes("mist") || lowerConditions.includes("haze")) {
    return (
      <svg className={`${sizeClass} text-snow-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 12h16M4 16h12" />
      </svg>
    );
  }

  // Default - partly cloudy
  return (
    <svg className={`${sizeClass} text-snow-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  );
}
