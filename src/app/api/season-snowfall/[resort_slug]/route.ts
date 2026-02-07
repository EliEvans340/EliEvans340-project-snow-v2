import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { resorts } from "@/db/schema";

const OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

interface HistoricalWeatherResponse {
  daily: {
    time: string[];
    snowfall_sum: number[];
  };
}

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

// Get ski season dates - typically Nov 1 to Apr 30
function getSeasonDates(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 10, 1), // November 1
    end: new Date(year + 1, 3, 30), // April 30
  };
}

// Get current season year (season starting year)
function getCurrentSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth();
  return month >= 10 ? now.getFullYear() : now.getFullYear() - 1;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Fetch daily snowfall data from Open-Meteo archive
async function fetchDailySnowfallData(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<{ date: string; snowfallCm: number }[]> {
  const url = new URL(OPEN_METEO_ARCHIVE_URL);
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("daily", "snowfall_sum");
  url.searchParams.set("timezone", "America/Los_Angeles");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo archive API error: ${response.statusText}`);
  }

  const data: HistoricalWeatherResponse = await response.json();

  return data.daily.time.map((date, i) => ({
    date,
    snowfallCm: data.daily.snowfall_sum[i] || 0,
  }));
}

// Convert daily snowfall array to cumulative points indexed by day-of-season
function toCumulativePoints(
  dailyData: { date: string; snowfallCm: number }[],
  seasonStart: Date
): CumulativePoint[] {
  let cumulative = 0;
  return dailyData.map((day) => {
    cumulative += day.snowfallCm / 2.54; // cm to inches
    const dayDate = new Date(day.date + "T00:00:00");
    const dayOfSeason = Math.round(
      (dayDate.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      dayOfSeason,
      cumulativeInches: Math.round(cumulative * 10) / 10,
    };
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resort_slug: string }> }
) {
  const { resort_slug } = await params;

  try {
    const db = getDb();

    const [resort] = await db
      .select()
      .from(resorts)
      .where(eq(resorts.slug, resort_slug))
      .limit(1);

    if (!resort) {
      return NextResponse.json({ error: "Resort not found" }, { status: 404 });
    }

    if (!resort.latitude || !resort.longitude) {
      return NextResponse.json(
        { error: "Resort coordinates not available" },
        { status: 400 }
      );
    }

    const latitude = parseFloat(resort.latitude);
    const longitude = parseFloat(resort.longitude);

    const today = new Date();
    const currentSeasonYear = getCurrentSeasonYear();
    const lastSeasonYear = currentSeasonYear - 1;

    const currentSeason = getSeasonDates(currentSeasonYear);
    const lastSeason = getSeasonDates(lastSeasonYear);

    const seasonStart = currentSeason.start;
    const daysIntoSeason = Math.max(
      0,
      Math.floor((today.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    const lastSeasonEquivalentEnd = new Date(lastSeason.start);
    lastSeasonEquivalentEnd.setDate(lastSeasonEquivalentEnd.getDate() + daysIntoSeason);

    const currentSeasonEnd = today < currentSeason.end ? today : currentSeason.end;

    // Fetch all three daily datasets in parallel
    const [currentDailyData, lastSeasonToDateData, lastSeasonFullData] =
      await Promise.all([
        fetchDailySnowfallData(
          latitude,
          longitude,
          formatDate(currentSeason.start),
          formatDate(currentSeasonEnd)
        ),
        fetchDailySnowfallData(
          latitude,
          longitude,
          formatDate(lastSeason.start),
          formatDate(lastSeasonEquivalentEnd)
        ),
        fetchDailySnowfallData(
          latitude,
          longitude,
          formatDate(lastSeason.start),
          formatDate(lastSeason.end)
        ),
      ]);

    // Convert to cumulative points
    const currentDaily = toCumulativePoints(currentDailyData, currentSeason.start);
    const lastSeasonToDateDaily = toCumulativePoints(lastSeasonToDateData, lastSeason.start);
    const lastSeasonFullDaily = toCumulativePoints(lastSeasonFullData, lastSeason.start);

    // Derive totals from cumulative arrays
    const currentTotal = currentDaily.length > 0
      ? currentDaily[currentDaily.length - 1].cumulativeInches
      : 0;
    const lastSeasonToDateTotal = lastSeasonToDateDaily.length > 0
      ? lastSeasonToDateDaily[lastSeasonToDateDaily.length - 1].cumulativeInches
      : 0;
    const lastSeasonFullTotal = lastSeasonFullDaily.length > 0
      ? lastSeasonFullDaily[lastSeasonFullDaily.length - 1].cumulativeInches
      : 0;

    const percentOfLastSeason =
      lastSeasonToDateTotal > 0
        ? Math.round((currentTotal / lastSeasonToDateTotal) * 100)
        : 0;

    const responseData: SeasonSnowfallData = {
      currentSeason: {
        startDate: formatDate(currentSeason.start),
        endDate: formatDate(currentSeasonEnd),
        totalSnowfall: Math.round(currentTotal),
        daysIntoSeason,
        daily: currentDaily,
      },
      lastSeason: {
        startDate: formatDate(lastSeason.start),
        endDate: formatDate(lastSeason.end),
        totalSnowfall: Math.round(lastSeasonToDateTotal),
        fullSeasonTotal: Math.round(lastSeasonFullTotal),
        dailyToDate: lastSeasonToDateDaily,
        dailyFull: lastSeasonFullDaily,
      },
      percentOfLastSeason,
    };

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (error) {
    console.error("Error fetching season snowfall:", error);
    return NextResponse.json(
      { error: "Failed to fetch season snowfall data" },
      { status: 500 }
    );
  }
}
