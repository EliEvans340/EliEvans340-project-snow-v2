// Multi-model weather client for Open-Meteo API
// Supports GFS, ECMWF, HRRR forecasts and historical data

export interface DailySnowfall {
  date: string; // YYYY-MM-DD
  snowfallInches: number;
}

export interface ModelForecast {
  available: boolean;
  data: DailySnowfall[];
  error?: string;
}

export interface MultiModelResponse {
  models: {
    gfs: ModelForecast;
    ecmwf: ModelForecast;
    hrrr: ModelForecast;
  };
  historical: DailySnowfall[];
  fetchedAt: string;
}

interface OpenMeteoModelResponse {
  daily?: {
    time: string[];
    snowfall_sum: number[];
  };
  hourly?: {
    time: string[];
    snowfall: number[];
  };
}

// Convert cm to inches
function cmToInches(cm: number): number {
  return cm / 2.54;
}

// Aggregate hourly data to daily totals
function aggregateHourlyToDaily(
  times: string[],
  values: number[]
): DailySnowfall[] {
  const dailyMap = new Map<string, number>();

  for (let i = 0; i < times.length; i++) {
    const date = times[i].split("T")[0];
    const current = dailyMap.get(date) || 0;
    dailyMap.set(date, current + (values[i] || 0));
  }

  return Array.from(dailyMap.entries()).map(([date, snowfall]) => ({
    date,
    snowfallInches: Math.round(cmToInches(snowfall) * 100) / 100,
  }));
}

// Fetch GFS forecast (16 days)
export async function fetchGFSForecast(
  lat: number,
  lng: number
): Promise<ModelForecast> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("models", "gfs_seamless");
    url.searchParams.set("daily", "snowfall_sum");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "16");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`GFS API error: ${response.status}`);
    }

    const data: OpenMeteoModelResponse = await response.json();

    if (!data.daily?.time || !data.daily?.snowfall_sum) {
      return { available: false, data: [], error: "No daily data" };
    }

    const dailyData: DailySnowfall[] = data.daily.time.map((date, i) => ({
      date,
      snowfallInches:
        Math.round(cmToInches(data.daily!.snowfall_sum[i] || 0) * 100) / 100,
    }));

    return { available: true, data: dailyData };
  } catch (error) {
    console.error("GFS fetch error:", error);
    return {
      available: false,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Fetch ECMWF forecast (15 days)
export async function fetchECMWFForecast(
  lat: number,
  lng: number
): Promise<ModelForecast> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/ecmwf");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("daily", "snowfall_sum");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`ECMWF API error: ${response.status}`);
    }

    const data: OpenMeteoModelResponse = await response.json();

    if (!data.daily?.time || !data.daily?.snowfall_sum) {
      return { available: false, data: [], error: "No daily data" };
    }

    const dailyData: DailySnowfall[] = data.daily.time.map((date, i) => ({
      date,
      snowfallInches:
        Math.round(cmToInches(data.daily!.snowfall_sum[i] || 0) * 100) / 100,
    }));

    return { available: true, data: dailyData };
  } catch (error) {
    console.error("ECMWF fetch error:", error);
    return {
      available: false,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Fetch HRRR forecast (48 hours only, US coverage)
export async function fetchHRRRForecast(
  lat: number,
  lng: number
): Promise<ModelForecast> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("models", "hrrr_conus");
    url.searchParams.set("hourly", "snowfall");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_hours", "48");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HRRR API error: ${response.status}`);
    }

    const data: OpenMeteoModelResponse = await response.json();

    if (!data.hourly?.time || !data.hourly?.snowfall) {
      return { available: false, data: [], error: "No hourly data" };
    }

    // Aggregate hourly to daily
    const dailyData = aggregateHourlyToDaily(
      data.hourly.time,
      data.hourly.snowfall
    );

    return { available: true, data: dailyData };
  } catch (error) {
    console.error("HRRR fetch error:", error);
    return {
      available: false,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Fetch historical snowfall (past 7 days)
export async function fetchHistoricalSnowfall(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<DailySnowfall[]> {
  try {
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set("daily", "snowfall_sum");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("Historical API error:", response.status);
      return [];
    }

    const data: OpenMeteoModelResponse = await response.json();

    if (!data.daily?.time || !data.daily?.snowfall_sum) {
      return [];
    }

    return data.daily.time.map((date, i) => ({
      date,
      snowfallInches:
        Math.round(cmToInches(data.daily!.snowfall_sum[i] || 0) * 100) / 100,
    }));
  } catch (error) {
    console.error("Historical fetch error:", error);
    return [];
  }
}

// Fetch all models and historical data in parallel
export async function fetchAllModels(
  lat: number,
  lng: number
): Promise<MultiModelResponse> {
  // Calculate dates for historical data (past 7 days)
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // Yesterday (archive may not have today)
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 7);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  // Fetch all data in parallel
  const [gfs, ecmwf, hrrr, historical] = await Promise.all([
    fetchGFSForecast(lat, lng),
    fetchECMWFForecast(lat, lng),
    fetchHRRRForecast(lat, lng),
    fetchHistoricalSnowfall(lat, lng, formatDate(startDate), formatDate(endDate)),
  ]);

  return {
    models: { gfs, ecmwf, hrrr },
    historical,
    fetchedAt: new Date().toISOString(),
  };
}
