const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast";

export interface OpenMeteoParams {
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation: number[];
  snowfall: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  relative_humidity_2m: number[];
  weather_code: number[];
  freezing_level_height: number[];
  snow_depth: number[];
}

export interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  snowfall_sum: number[];
  wind_speed_10m_max: number[];
  weather_code: number[];
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
}

export class WeatherApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "WeatherApiError";
  }
}

export async function fetchForecast(
  params: OpenMeteoParams
): Promise<OpenMeteoResponse> {
  const { latitude, longitude, timezone = "America/Los_Angeles" } = params;

  const hourlyParams = [
    "temperature_2m",
    "apparent_temperature",
    "precipitation",
    "snowfall",
    "wind_speed_10m",
    "wind_gusts_10m",
    "relative_humidity_2m",
    "weather_code",
    "freezing_level_height",
    "snow_depth",
  ].join(",");

  const dailyParams = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "snowfall_sum",
    "wind_speed_10m_max",
    "weather_code",
  ].join(",");

  const url = new URL(OPEN_METEO_BASE_URL);
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("hourly", hourlyParams);
  url.searchParams.set("daily", dailyParams);
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("forecast_days", "10");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new WeatherApiError(
      `Open-Meteo API error: ${response.statusText}`,
      response.status
    );
  }

  return response.json();
}
