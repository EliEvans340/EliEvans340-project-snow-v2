const POWDERLINES_BASE_URL = "https://powderlines.kellysoftware.org";
const MAX_DISTANCE_KM = 25;

const SNOTEL_STATES = new Set([
  "Alaska",
  "Arizona",
  "California",
  "Colorado",
  "Idaho",
  "Montana",
  "Nevada",
  "New Mexico",
  "Oregon",
  "Utah",
  "Washington",
  "Wyoming",
  "South Dakota",
]);

export interface SnotelSnowDepth {
  snowDepthInches: number;
  stationName: string;
  distanceKm: number;
}

export function isInSnotelCoverage(state: string): boolean {
  return SNOTEL_STATES.has(state);
}

function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function fetchSnotelSnowDepth(
  lat: number,
  lng: number
): Promise<SnotelSnowDepth | null> {
  try {
    const url = `${POWDERLINES_BASE_URL}/api/closest_stations?lat=${lat}&lng=${lng}&count=1&data=true&days=1`;

    const response = await fetch(url, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const station = data[0];
    const stationLat = parseFloat(station.latitude);
    const stationLng = parseFloat(station.longitude);

    if (isNaN(stationLat) || isNaN(stationLng)) {
      return null;
    }

    const distanceKm = haversineDistanceKm(lat, lng, stationLat, stationLng);

    if (distanceKm > MAX_DISTANCE_KM) {
      return null;
    }

    const snowDepth = station.data?.[0]?.snow_depth;
    if (snowDepth == null || snowDepth < 0) {
      return null;
    }

    return {
      snowDepthInches: Math.round(snowDepth),
      stationName: station.station_name || "SNOTEL Station",
      distanceKm: Math.round(distanceKm * 10) / 10,
    };
  } catch {
    return null;
  }
}
