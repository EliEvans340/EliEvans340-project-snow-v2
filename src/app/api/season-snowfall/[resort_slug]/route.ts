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

interface SeasonSnowfallData {
  currentSeason: {
    startDate: string;
    endDate: string;
    totalSnowfall: number; // in inches
    daysIntoSeason: number;
  };
  lastSeason: {
    startDate: string;
    endDate: string;
    totalSnowfall: number; // in inches (at same point in season)
    fullSeasonTotal: number; // in inches (full season)
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
  // If we're in Jan-Oct, the season started last year
  // If we're in Nov-Dec, the season started this year
  return month >= 10 ? now.getFullYear() : now.getFullYear() - 1;
}

async function fetchHistoricalSnowfall(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<number> {
  const url = new URL(OPEN_METEO_ARCHIVE_URL);
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("daily", "snowfall_sum");
  url.searchParams.set("timezone", "America/Los_Angeles");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo archive API error: ${response.statusText}`);
  }

  const data: HistoricalWeatherResponse = await response.json();

  // Sum up all daily snowfall (Open-Meteo returns snowfall in cm)
  const totalCm = data.daily.snowfall_sum.reduce((sum, val) => sum + (val || 0), 0);

  // Convert cm to inches
  return totalCm / 2.54;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resort_slug: string }> }
) {
  const { resort_slug } = await params;

  try {
    const db = getDb();

    // Get resort details
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

    // Calculate days into the current season
    const seasonStart = currentSeason.start;
    const daysIntoSeason = Math.max(
      0,
      Math.floor((today.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Calculate the equivalent date in last season
    const lastSeasonEquivalentEnd = new Date(lastSeason.start);
    lastSeasonEquivalentEnd.setDate(lastSeasonEquivalentEnd.getDate() + daysIntoSeason);

    // Ensure we don't query future dates
    const currentSeasonEnd = today < currentSeason.end ? today : currentSeason.end;

    // Fetch snowfall data in parallel
    const [currentSnowfall, lastSeasonToDateSnowfall, lastSeasonFullSnowfall] =
      await Promise.all([
        fetchHistoricalSnowfall(
          latitude,
          longitude,
          formatDate(currentSeason.start),
          formatDate(currentSeasonEnd)
        ),
        fetchHistoricalSnowfall(
          latitude,
          longitude,
          formatDate(lastSeason.start),
          formatDate(lastSeasonEquivalentEnd)
        ),
        fetchHistoricalSnowfall(
          latitude,
          longitude,
          formatDate(lastSeason.start),
          formatDate(lastSeason.end)
        ),
      ]);

    const percentOfLastSeason =
      lastSeasonToDateSnowfall > 0
        ? Math.round((currentSnowfall / lastSeasonToDateSnowfall) * 100)
        : 0;

    const responseData: SeasonSnowfallData = {
      currentSeason: {
        startDate: formatDate(currentSeason.start),
        endDate: formatDate(currentSeasonEnd),
        totalSnowfall: Math.round(currentSnowfall),
        daysIntoSeason,
      },
      lastSeason: {
        startDate: formatDate(lastSeason.start),
        endDate: formatDate(lastSeason.end),
        totalSnowfall: Math.round(lastSeasonToDateSnowfall),
        fullSeasonTotal: Math.round(lastSeasonFullSnowfall),
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
