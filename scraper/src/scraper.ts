/**
 * Scraper for skiresort.info
 * Fetches resort conditions and static info
 */

export interface ScrapedConditions {
  snowDepthSummit: number | null;
  snowDepthBase: number | null;
  newSnow24h: number | null;
  newSnow48h: number | null;
  newSnow7d: number | null;
  liftsOpen: number | null;
  liftsTotal: number | null;
  runsOpen: number | null;
  runsTotal: number | null;
  terrainOpenKm: number | null;
  terrainTotalKm: number | null;
  terrainOpenPct: number | null;
  isOpen: boolean;
  seasonStart: string | null;
  seasonEnd: string | null;
  lastSnowfall: string | null;
  conditions: string | null;
  firstChair: string | null;
  lastChair: string | null;
}

export interface ScrapedResortInfo {
  elevationBase: number | null;
  elevationSummit: number | null;
  verticalDrop: number | null;
  terrainTotalKm: number | null;
  terrainEasyKm: number | null;
  terrainIntermediateKm: number | null;
  terrainDifficultKm: number | null;
  terrainEasyPct: number | null;
  terrainIntermediatePct: number | null;
  terrainDifficultPct: number | null;
  liftsTotal: number | null;
  liftsGondolas: number | null;
  liftsChairliftsHighSpeed: number | null;
  liftsChairliftsFixedGrip: number | null;
  liftsSurface: number | null;
  liftsCarpets: number | null;
  runsTotal: number | null;
}

export async function scrapeResortConditions(
  skiresortinfoId: string
): Promise<{ conditions: ScrapedConditions; info: ScrapedResortInfo } | null> {
  const baseUrl = `https://www.skiresort.info/ski-resort/${skiresortinfoId}/`;
  const liftsUrl = `https://www.skiresort.info/ski-resort/${skiresortinfoId}/ski-lifts/`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
  };

  try {
    // Fetch main page
    const response = await fetch(baseUrl, { headers });

    if (!response.ok) {
      console.error(`Failed to fetch ${baseUrl}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Parse the HTML to extract data
    const conditions = parseConditions(html);
    let info = parseResortInfo(html);

    // Fetch lift details page for lift type breakdown
    try {
      const liftsResponse = await fetch(liftsUrl, { headers });
      if (liftsResponse.ok) {
        const liftsHtml = await liftsResponse.text();
        info = parseLiftDetails(liftsHtml, info);
      }
    } catch (liftError) {
      console.error(`Failed to fetch lift details for ${skiresortinfoId}:`, liftError);
    }

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

  // Snow depth
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

  // Lifts
  const liftsMatch = html.match(/(\d+)\s*(?:of|\/)\s*(\d+)\s*lifts?/i);
  if (liftsMatch) {
    conditions.liftsOpen = parseInt(liftsMatch[1]);
    conditions.liftsTotal = parseInt(liftsMatch[2]);
  }

  // Terrain
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

  // Operating hours
  const hoursMatch = html.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (hoursMatch) {
    conditions.firstChair = hoursMatch[1].trim();
    conditions.lastChair = hoursMatch[2].trim();
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
    liftsGondolas: null,
    liftsChairliftsHighSpeed: null,
    liftsChairliftsFixedGrip: null,
    liftsSurface: null,
    liftsCarpets: null,
    runsTotal: null,
  };

  // Elevation - pattern: "2457 m - 3527 m (Difference 1070 m)"
  const elevationMatch = html.match(/([\d,]+)\s*m\s*[-–]\s*([\d,]+)\s*m\s*\((?:Difference|Diff\.?)\s*([\d,]+)\s*m\)/i);
  if (elevationMatch) {
    info.elevationBase = parseInt(elevationMatch[1].replace(/,/g, ""));
    info.elevationSummit = parseInt(elevationMatch[2].replace(/,/g, ""));
    info.verticalDrop = parseInt(elevationMatch[3].replace(/,/g, ""));
  }

  // Total terrain
  const totalTerrainMatch = html.match(/(?:total|slopes?)[\s:]*?([\d.]+)\s*km/i) ||
                            html.match(/([\d.]+)\s*km\s*(?:of\s*)?(?:slopes?|pistes?|runs?|terrain)/i);
  if (totalTerrainMatch) {
    info.terrainTotalKm = parseFloat(totalTerrainMatch[1]);
  }

  // Terrain breakdown
  const easyMatch = html.match(/easy[\s\S]*?([\d.]+)\s*km[\s\S]*?\((\d+)\s*%\)/i);
  if (easyMatch) {
    info.terrainEasyKm = parseFloat(easyMatch[1]);
    info.terrainEasyPct = parseInt(easyMatch[2]);
  }

  const intermediateMatch = html.match(/intermediate[\s\S]*?([\d.]+)\s*km[\s\S]*?\((\d+)\s*%\)/i);
  if (intermediateMatch) {
    info.terrainIntermediateKm = parseFloat(intermediateMatch[1]);
    info.terrainIntermediatePct = parseInt(intermediateMatch[2]);
  }

  const difficultMatch = html.match(/difficult[\s\S]*?([\d.]+)\s*km[\s\S]*?\((\d+)\s*%\)/i);
  if (difficultMatch) {
    info.terrainDifficultKm = parseFloat(difficultMatch[1]);
    info.terrainDifficultPct = parseInt(difficultMatch[2]);
  }

  // Lifts
  const liftsOpenTotalMatch = html.match(/(\d+)\s*\/\s*(\d+)\s*(?:ski\s*)?lifts/i);
  if (liftsOpenTotalMatch) {
    info.liftsTotal = parseInt(liftsOpenTotalMatch[2]);
  } else {
    const liftsMatch = html.match(/number\s*of\s*(?:ski\s*)?lifts[:\s]*(\d+)/i) ||
                       html.match(/(?:ski\s*)?lifts[:\s]*(\d+)/i);
    if (liftsMatch) {
      info.liftsTotal = parseInt(liftsMatch[1]);
    }
  }

  // Runs
  const runsMatch = html.match(/(\d+)\s*(?:ski\s*)?(?:runs|trails|pistes)/i);
  if (runsMatch) {
    info.runsTotal = parseInt(runsMatch[1]);
  }

  return info;
}

function parseLiftDetails(html: string, info: ScrapedResortInfo): ScrapedResortInfo {
  // Gondolas
  const gondolaMatch = html.match(/circulating\s*ropeway\/gondola\s*lift\s*\((\d+)\)/i) ||
                       html.match(/gondola\s*lift[^(]*\((\d+)\)/i);
  if (gondolaMatch) {
    info.liftsGondolas = parseInt(gondolaMatch[1]);
  }

  // Chairlifts
  const chairliftMatch = html.match(/,\s*chairlift\s*\((\d+)\)/i);
  if (chairliftMatch) {
    info.liftsChairliftsHighSpeed = parseInt(chairliftMatch[1]);
  }

  // Surface lifts
  const surfaceMatch = html.match(/t[- ]?bar\s*lift\/platter\/button\s*lift\s*\((\d+)\)/i);
  if (surfaceMatch) {
    info.liftsSurface = parseInt(surfaceMatch[1]);
  }

  // Magic carpets
  const carpetMatch = html.match(/people\s*mover\/moving\s*carpet\s*\((\d+)\)/i) ||
                      html.match(/moving\s*carpet\s*\((\d+)\)/i);
  if (carpetMatch) {
    info.liftsCarpets = parseInt(carpetMatch[1]);
  }

  // Calculate total from components if not set
  if (!info.liftsTotal) {
    const componentTotal = (info.liftsGondolas || 0) +
                           (info.liftsChairliftsHighSpeed || 0) +
                           (info.liftsChairliftsFixedGrip || 0) +
                           (info.liftsSurface || 0) +
                           (info.liftsCarpets || 0);
    if (componentTotal > 0) {
      info.liftsTotal = componentTotal;
    }
  }

  return info;
}
