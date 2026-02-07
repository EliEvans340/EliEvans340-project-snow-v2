// Multi-model hourly weather client for Open-Meteo API
// Fetches hourly forecast data from GFS, ECMWF, and HRRR models

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

export interface HourlyDataPoint {
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

export interface HourlyModelForecast {
  available: boolean;
  data: HourlyDataPoint[];
  error?: string;
}

export interface MultiModelHourlyResponse {
  models: {
    gfs: HourlyModelForecast;
    ecmwf: HourlyModelForecast;
    hrrr: HourlyModelForecast;
  };
  fetchedAt: string;
}

function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

function getCondition(code: number | null): string {
  if (code === null || code === undefined) return "Unknown";
  return WEATHER_CODE_DESCRIPTIONS[code] ?? "Unknown";
}

interface OpenMeteoHourlyRaw {
  time?: string[];
  temperature_2m?: number[];
  apparent_temperature?: number[];
  snowfall?: number[];
  precipitation?: number[];
  wind_speed_10m?: number[];
  wind_gusts_10m?: number[];
  relative_humidity_2m?: number[];
  weather_code?: number[];
  freezing_level_height?: number[];
}

// Convert cm snowfall to inches
function cmToInches(cm: number): number {
  return cm / 2.54;
}

function transformHourlyData(
  hourly: OpenMeteoHourlyRaw,
  hasFreezing: boolean
): HourlyDataPoint[] {
  if (!hourly.time) return [];

  return hourly.time.map((time, i) => ({
    time,
    tempF: hourly.temperature_2m?.[i] ?? null,
    feelsLikeF: hourly.apparent_temperature?.[i] ?? null,
    snowInches:
      hourly.snowfall?.[i] != null
        ? Math.round(cmToInches(hourly.snowfall[i]) * 100) / 100
        : null,
    precipInches: hourly.precipitation?.[i] ?? null,
    windMph: hourly.wind_speed_10m?.[i] ?? null,
    gustMph: hourly.wind_gusts_10m?.[i] ?? null,
    humidityPct: hourly.relative_humidity_2m?.[i] ?? null,
    weatherCode: hourly.weather_code?.[i] ?? null,
    conditions: getCondition(hourly.weather_code?.[i] ?? null),
    freezingLevelFt:
      hasFreezing && hourly.freezing_level_height?.[i] != null
        ? metersToFeet(hourly.freezing_level_height[i])
        : null,
  }));
}

const HOURLY_PARAMS_BASE = [
  "temperature_2m",
  "apparent_temperature",
  "snowfall",
  "precipitation",
  "wind_speed_10m",
  "wind_gusts_10m",
  "relative_humidity_2m",
  "weather_code",
];

const HOURLY_PARAMS_WITH_FREEZING = [
  ...HOURLY_PARAMS_BASE,
  "freezing_level_height",
];

// Fetch GFS hourly (16 days, ~25km)
export async function fetchGFSHourly(
  lat: number,
  lng: number,
  tz: string
): Promise<HourlyModelForecast> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("models", "gfs_seamless");
    url.searchParams.set("hourly", HOURLY_PARAMS_WITH_FREEZING.join(","));
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("timezone", tz);
    url.searchParams.set("forecast_hours", "48");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`GFS API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.hourly?.time?.length) {
      return { available: false, data: [], error: "No hourly data" };
    }

    return {
      available: true,
      data: transformHourlyData(data.hourly, true),
    };
  } catch (error) {
    console.error("GFS hourly fetch error:", error);
    return {
      available: false,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Fetch ECMWF hourly (15 days, ~9km) — no freezing_level_height on this endpoint
export async function fetchECMWFHourly(
  lat: number,
  lng: number,
  tz: string
): Promise<HourlyModelForecast> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/ecmwf");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("hourly", HOURLY_PARAMS_BASE.join(","));
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("timezone", tz);
    url.searchParams.set("forecast_hours", "48");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`ECMWF API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.hourly?.time?.length) {
      return { available: false, data: [], error: "No hourly data" };
    }

    return {
      available: true,
      data: transformHourlyData(data.hourly, false),
    };
  } catch (error) {
    console.error("ECMWF hourly fetch error:", error);
    return {
      available: false,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Fetch HRRR hourly (48hr, 3km, US only)
export async function fetchHRRRHourly(
  lat: number,
  lng: number,
  tz: string
): Promise<HourlyModelForecast> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("models", "hrrr_conus");
    url.searchParams.set("hourly", HOURLY_PARAMS_WITH_FREEZING.join(","));
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("timezone", tz);
    url.searchParams.set("forecast_hours", "48");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HRRR API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.hourly?.time?.length) {
      return { available: false, data: [], error: "No hourly data" };
    }

    return {
      available: true,
      data: transformHourlyData(data.hourly, true),
    };
  } catch (error) {
    console.error("HRRR hourly fetch error:", error);
    return {
      available: false,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Fetch all models in parallel
export async function fetchAllModelsHourly(
  lat: number,
  lng: number,
  tz: string
): Promise<MultiModelHourlyResponse> {
  const [gfs, ecmwf, hrrr] = await Promise.all([
    fetchGFSHourly(lat, lng, tz),
    fetchECMWFHourly(lat, lng, tz),
    fetchHRRRHourly(lat, lng, tz),
  ]);

  return {
    models: { gfs, ecmwf, hrrr },
    fetchedAt: new Date().toISOString(),
  };
}
