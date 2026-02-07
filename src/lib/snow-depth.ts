import { fetchSnotelSnowDepth, isInSnotelCoverage } from "./snotel";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { snowDepthReadings } from "@/db/schema";

const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const METERS_TO_INCHES = 39.3701;

export interface SnowDepthFallback {
  depthInches: number;
  source: "snotel" | "open-meteo";
  sourceDetail: string;
}

async function fetchOpenMeteoSnowDepth(
  lat: number,
  lng: number
): Promise<number | null> {
  try {
    const url = `${OPEN_METEO_BASE_URL}?latitude=${lat}&longitude=${lng}&hourly=snow_depth&forecast_days=1`;

    const response = await fetch(url, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const snowDepths: number[] | undefined = data?.hourly?.snow_depth;

    if (!Array.isArray(snowDepths) || snowDepths.length === 0) {
      return null;
    }

    // Find the most recent non-null value
    for (let i = snowDepths.length - 1; i >= 0; i--) {
      if (snowDepths[i] != null && snowDepths[i] >= 0) {
        return snowDepths[i];
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** DB-first lookup: query snow_depth_readings for stored data */
export async function getSnowDepthForResort(
  resortId: string
): Promise<SnowDepthFallback | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(snowDepthReadings)
      .where(eq(snowDepthReadings.resortId, resortId))
      .limit(1);

    if (!row) return null;

    return {
      depthInches: row.depthInches,
      source: row.source as "snotel" | "open-meteo",
      sourceDetail: row.sourceDetail,
    };
  } catch {
    return null;
  }
}

/** On-demand fallback: fetch live from SNOTEL/Open-Meteo */
export async function getSnowDepthFallback(
  lat: number,
  lng: number,
  state: string
): Promise<SnowDepthFallback | null> {
  // Try SNOTEL first (western US only)
  if (isInSnotelCoverage(state)) {
    const snotel = await fetchSnotelSnowDepth(lat, lng);
    if (snotel && snotel.snowDepthInches > 0) {
      return {
        depthInches: snotel.snowDepthInches,
        source: "snotel",
        sourceDetail: snotel.stationName,
      };
    }
  }

  // Fall back to Open-Meteo (global)
  const depthMeters = await fetchOpenMeteoSnowDepth(lat, lng);
  if (depthMeters != null && depthMeters > 0) {
    const depthInches = Math.round(depthMeters * METERS_TO_INCHES);
    if (depthInches > 0) {
      return {
        depthInches,
        source: "open-meteo",
        sourceDetail: "Open-Meteo",
      };
    }
  }

  return null;
}
