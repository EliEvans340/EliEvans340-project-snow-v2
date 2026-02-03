import type { OpenMeteoResponse } from "./client";
import type { NewHourlyForecast, NewDailyForecast } from "@/db/schema";

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function getConditionDescription(code: number): string {
  return WEATHER_CODE_DESCRIPTIONS[code] ?? "Unknown";
}

function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

export function transformHourlyForecasts(
  response: OpenMeteoResponse,
  snapshotId: string
): Omit<NewHourlyForecast, "id">[] {
  const { hourly } = response;

  return hourly.time.slice(0, 72).map((time, i) => ({
    snapshotId,
    forecastTime: new Date(time),
    tempF: hourly.temperature_2m[i]?.toString() ?? null,
    feelsLikeF: hourly.apparent_temperature[i]?.toString() ?? null,
    snowInches: hourly.snowfall[i]?.toString() ?? null,
    precipInches: hourly.precipitation[i]?.toString() ?? null,
    windMph: hourly.wind_speed_10m[i]?.toString() ?? null,
    gustMph: hourly.wind_gusts_10m[i]?.toString() ?? null,
    humidityPct: hourly.relative_humidity_2m[i] ?? null,
    conditions: getConditionDescription(hourly.weather_code[i]),
    freezingLevelFt: hourly.freezing_level_height[i]
      ? metersToFeet(hourly.freezing_level_height[i])
      : null,
    snowLevelFt: null,
  }));
}

export function transformDailyForecasts(
  response: OpenMeteoResponse,
  snapshotId: string
): Omit<NewDailyForecast, "id">[] {
  const { daily } = response;

  return daily.time.map((date, i) => ({
    snapshotId,
    forecastDate: date,
    highTempF: daily.temperature_2m_max[i]?.toString() ?? null,
    lowTempF: daily.temperature_2m_min[i]?.toString() ?? null,
    snowTotalInches: daily.snowfall_sum[i]?.toString() ?? null,
    windAvgMph: daily.wind_speed_10m_max[i]?.toString() ?? null,
    conditionsSummary: getConditionDescription(daily.weather_code[i]),
  }));
}
