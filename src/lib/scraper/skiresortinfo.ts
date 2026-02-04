/**
 * Scraper for skiresort.info
 * Fetches resort conditions and static info
 */

export interface ScrapedConditions {
  // Snow (in cm)
  snowDepthSummit: number | null;
  snowDepthBase: number | null;
  newSnow24h: number | null;
  newSnow48h: number | null;
  newSnow7d: number | null;

  // Operations
  liftsOpen: number | null;
  liftsTotal: number | null;
  runsOpen: number | null;
  runsTotal: number | null;
  terrainOpenKm: number | null;
  terrainTotalKm: number | null;
  terrainOpenPct: number | null;

  // Status
  isOpen: boolean;
  seasonStart: string | null;
  seasonEnd: string | null;
  lastSnowfall: string | null;
  conditions: string | null;

  // Operating hours
  firstChair: string | null;
  lastChair: string | null;
}

export interface ScrapedResortInfo {
  // Elevation (in meters)
  elevationBase: number | null;
  elevationSummit: number | null;
  verticalDrop: number | null;

  // Terrain
  terrainTotalKm: number | null;
  terrainEasyKm: number | null;
  terrainIntermediateKm: number | null;
  terrainDifficultKm: number | null;
  terrainEasyPct: number | null;
  terrainIntermediatePct: number | null;
  terrainDifficultPct: number | null;

  // Infrastructure
  liftsTotal: number | null;
  runsTotal: number | null;
}

// Helper to extract number from text like "94 cm" or "18 of 34"
function extractNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/[\d,.]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(",", ""));
}

// Helper to extract "X of Y" pattern
function extractOfPattern(text: string | null | undefined): { open: number | null; total: number | null } {
  if (!text) return { open: null, total: null };
  const match = text.match(/([\d,.]+)\s*(?:of|\/)\s*([\d,.]+)/i);
  if (!match) return { open: null, total: null };
  return {
    open: parseFloat(match[1].replace(",", "")),
    total: parseFloat(match[2].replace(",", "")),
  };
}

// Helper to extract percentage
function extractPercentage(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/([\d,.]+)\s*%/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", ""));
}

// Helper to extract date (YYYY-MM-DD format)
function extractDate(text: string | null | undefined): string | null {
  if (!text) return null;
  // Try to match various date formats
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // Match formats like "Nov 14, 2025" or "14 Nov 2025"
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const dateMatch = text.match(/(\d{1,2})\s*([a-zA-Z]{3})\s*(\d{4})/i) ||
                    text.match(/([a-zA-Z]{3})\s*(\d{1,2}),?\s*(\d{4})/i);

  if (dateMatch) {
    let day, month, year;
    if (dateMatch[1].match(/^\d+$/)) {
      day = dateMatch[1].padStart(2, "0");
      month = months[dateMatch[2].toLowerCase()];
      year = dateMatch[3];
    } else {
      month = months[dateMatch[1].toLowerCase()];
      day = dateMatch[2].padStart(2, "0");
      year = dateMatch[3];
    }
    if (month) return `${year}-${month}-${day}`;
  }

  return null;
}

export async function scrapeResortConditions(
  skiresortinfoId: string
): Promise<{ conditions: ScrapedConditions; info: ScrapedResortInfo } | null> {
  const url = `https://www.skiresort.info/ski-resort/${skiresortinfoId}/`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Parse the HTML to extract data
    const conditions = parseConditions(html);
    const info = parseResortInfo(html);

    return { conditions, info };
  } catch (error) {
    console.error(`Error scraping ${skiresortinfoId}:`, error);
    return null;
  }
}

function parseConditions(html: string): ScrapedConditions {
  const conditions: ScrapedConditions = {
    snowDepthSummit: null,
    snowDepthBase: null,
    newSnow24h: null,
    newSnow48h: null,
    newSnow7d: null,
    liftsOpen: null,
    liftsTotal: null,
    runsOpen: null,
    runsTotal: null,
    terrainOpenKm: null,
    terrainTotalKm: null,
    terrainOpenPct: null,
    isOpen: false,
    seasonStart: null,
    seasonEnd: null,
    lastSnowfall: null,
    conditions: null,
    firstChair: null,
    lastChair: null,
  };

  // Check if resort is open
  conditions.isOpen = html.includes("resort is open") ||
                      html.includes("ski resort is open") ||
                      (html.includes("lifts") && html.includes(" of ") && !html.includes("0 of"));

  // Snow depth - look for patterns like "Snow depth on summit: 94 cm"
  const summitSnowMatch = html.match(/(?:summit|top).*?(\d+)\s*cm/i) ||
                          html.match(/(\d+)\s*cm.*?(?:summit|top)/i);
  if (summitSnowMatch) {
    conditions.snowDepthSummit = parseInt(summitSnowMatch[1]);
  }

  const baseSnowMatch = html.match(/(?:base|valley|bottom).*?(\d+)\s*cm/i) ||
                        html.match(/(\d+)\s*cm.*?(?:base|valley|bottom)/i);
  if (baseSnowMatch) {
    conditions.snowDepthBase = parseInt(baseSnowMatch[1]);
  }

  // Lifts - look for "18 of 34 lifts" pattern
  const liftsMatch = html.match(/(\d+)\s*(?:of|\/)\s*(\d+)\s*lifts?/i);
  if (liftsMatch) {
    conditions.liftsOpen = parseInt(liftsMatch[1]);
    conditions.liftsTotal = parseInt(liftsMatch[2]);
  }

  // Terrain open - look for "144.4 of 234 km" or "62% open"
  const terrainKmMatch = html.match(/([\d.]+)\s*(?:of|\/)\s*([\d.]+)\s*km/i);
  if (terrainKmMatch) {
    conditions.terrainOpenKm = parseFloat(terrainKmMatch[1]);
    conditions.terrainTotalKm = parseFloat(terrainKmMatch[2]);
  }

  const terrainPctMatch = html.match(/(\d+)\s*%\s*open/i);
  if (terrainPctMatch) {
    conditions.terrainOpenPct = parseInt(terrainPctMatch[1]);
  }

  // Season dates
  const seasonMatch = html.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|[-–])\s*(\d{4}-\d{2}-\d{2})/);
  if (seasonMatch) {
    conditions.seasonStart = seasonMatch[1];
    conditions.seasonEnd = seasonMatch[2];
  }

  // Operating hours - look for patterns like "8:30 AM - 4:00 PM" or "First chair: 8:30"
  const hoursMatch = html.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (hoursMatch) {
    conditions.firstChair = hoursMatch[1].trim();
    conditions.lastChair = hoursMatch[2].trim();
  } else {
    // Try separate patterns
    const firstChairMatch = html.match(/(?:first\s*chair|opens?)[:\s]*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (firstChairMatch) {
      conditions.firstChair = firstChairMatch[1].trim();
    }
    const lastChairMatch = html.match(/(?:last\s*chair|closes?)[:\s]*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (lastChairMatch) {
      conditions.lastChair = lastChairMatch[1].trim();
    }
  }

  return conditions;
}

function parseResortInfo(html: string): ScrapedResortInfo {
  const info: ScrapedResortInfo = {
    elevationBase: null,
    elevationSummit: null,
    verticalDrop: null,
    terrainTotalKm: null,
    terrainEasyKm: null,
    terrainIntermediateKm: null,
    terrainDifficultKm: null,
    terrainEasyPct: null,
    terrainIntermediatePct: null,
    terrainDifficultPct: null,
    liftsTotal: null,
    runsTotal: null,
  };

  // Elevation - look for patterns like "Base elevation: 2,457 m"
  const baseElevMatch = html.match(/(?:base|valley|bottom)\s*(?:elevation)?[:\s]*?([\d,]+)\s*m/i);
  if (baseElevMatch) {
    info.elevationBase = parseInt(baseElevMatch[1].replace(",", ""));
  }

  const summitElevMatch = html.match(/(?:summit|top|peak)\s*(?:elevation)?[:\s]*?([\d,]+)\s*m/i);
  if (summitElevMatch) {
    info.elevationSummit = parseInt(summitElevMatch[1].replace(",", ""));
  }

  const verticalMatch = html.match(/(?:vertical|drop)[:\s]*?([\d,]+)\s*m/i);
  if (verticalMatch) {
    info.verticalDrop = parseInt(verticalMatch[1].replace(",", ""));
  }

  // Total terrain
  const totalTerrainMatch = html.match(/([\d.]+)\s*km\s*(?:of)?\s*(?:slopes?|terrain|pistes?)/i);
  if (totalTerrainMatch) {
    info.terrainTotalKm = parseFloat(totalTerrainMatch[1]);
  }

  // Terrain breakdown - look for "Easy: 57 km (24%)"
  const easyMatch = html.match(/(?:easy|beginner|green)[:\s]*?([\d.]+)\s*km.*?(\d+)\s*%/i);
  if (easyMatch) {
    info.terrainEasyKm = parseFloat(easyMatch[1]);
    info.terrainEasyPct = parseInt(easyMatch[2]);
  }

  const intermediateMatch = html.match(/(?:intermediate|blue)[:\s]*?([\d.]+)\s*km.*?(\d+)\s*%/i);
  if (intermediateMatch) {
    info.terrainIntermediateKm = parseFloat(intermediateMatch[1]);
    info.terrainIntermediatePct = parseInt(intermediateMatch[2]);
  }

  const difficultMatch = html.match(/(?:difficult|advanced|expert|black)[:\s]*?([\d.]+)\s*km.*?(\d+)\s*%/i);
  if (difficultMatch) {
    info.terrainDifficultKm = parseFloat(difficultMatch[1]);
    info.terrainDifficultPct = parseInt(difficultMatch[2]);
  }

  // Total lifts
  const liftsMatch = html.match(/(\d+)\s*(?:ski\s*)?lifts?/i);
  if (liftsMatch) {
    info.liftsTotal = parseInt(liftsMatch[1]);
  }

  return info;
}
