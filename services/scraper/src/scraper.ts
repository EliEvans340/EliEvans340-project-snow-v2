import * as cheerio from "cheerio";

export interface ScrapedResortData {
  liftsTotal: number | null;
  liftsOpen: number | null;
  runsTotal: number | null;
  runsOpen: number | null;
  skiableKm: number | null;
  difficultyEasy: number | null;
  difficultyIntermediate: number | null;
  difficultyAdvanced: number | null;
  baseDepthInches: number | null;
  summitDepthInches: number | null;
  snow24hInches: number | null;
  snow72hInches: number | null;
}

// Convert cm to inches
function cmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

export async function scrapeResort(
  skiresortinfoId: string
): Promise<ScrapedResortData | null> {
  const url = `https://www.skiresort.info/ski-resort/${skiresortinfoId}/`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ProjectSnow/1.0; +https://projectsnow.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const data: ScrapedResortData = {
      liftsTotal: null,
      liftsOpen: null,
      runsTotal: null,
      runsOpen: null,
      skiableKm: null,
      difficultyEasy: null,
      difficultyIntermediate: null,
      difficultyAdvanced: null,
      baseDepthInches: null,
      summitDepthInches: null,
      snow24hInches: null,
      snow72hInches: null,
    };

    // Parse the full page text for various data points
    const pageText = $("body").text();

    // Look for lift data in various formats
    // Pattern: "X/Y" where X is open and Y is total, near "Lifts" or "lifts"
    const liftPatterns = [
      /lifts?\s*[:\s]*(\d+)\s*\/\s*(\d+)/i,
      /(\d+)\s*\/\s*(\d+)\s*lifts?/i,
      /lifts?\s+open[:\s]*(\d+)\s*\/\s*(\d+)/i,
    ];

    for (const pattern of liftPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        data.liftsOpen = parseInt(match[1], 10);
        data.liftsTotal = parseInt(match[2], 10);
        break;
      }
    }

    // Look for runs/slopes data
    // Pattern: "X km" or "X/Y km" for slopes
    const slopesPatterns = [
      /slopes?\s*[:\s]*([\d.]+)\s*\/\s*([\d.]+)\s*km/i,
      /([\d.]+)\s*\/\s*([\d.]+)\s*km\s*(?:of\s*)?slopes?/i,
      /slopes?\s*open[:\s]*([\d.]+)\s*km/i,
    ];

    for (const pattern of slopesPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        if (match[2]) {
          // Has fraction
          data.runsOpen = Math.round(parseFloat(match[1]));
          data.runsTotal = Math.round(parseFloat(match[2]));
        } else {
          data.runsOpen = Math.round(parseFloat(match[1]));
        }
        break;
      }
    }

    // Look for total skiable km
    const totalKmPatterns = [
      /total[:\s]*([\d.]+)\s*km/i,
      /([\d.]+)\s*km\s*(?:of\s*)?(?:slopes?|pistes?|terrain)/i,
    ];

    for (const pattern of totalKmPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        data.skiableKm = parseFloat(match[1]);
        break;
      }
    }

    // Parse difficulty breakdown
    // Look for patterns like "Easy: 57 km" or "easy 57 km (24%)"
    const easyMatch = pageText.match(
      /(?:easy|beginner|green)[:\s]*([\d.]+)\s*km/i
    );
    const intermediateMatch = pageText.match(
      /(?:intermediate|blue)[:\s]*([\d.]+)\s*km/i
    );
    const advancedMatch = pageText.match(
      /(?:advanced|difficult|expert|black)[:\s]*([\d.]+)\s*km/i
    );

    if (easyMatch) data.difficultyEasy = Math.round(parseFloat(easyMatch[1]));
    if (intermediateMatch)
      data.difficultyIntermediate = Math.round(
        parseFloat(intermediateMatch[1])
      );
    if (advancedMatch)
      data.difficultyAdvanced = Math.round(parseFloat(advancedMatch[1]));

    // Parse snow depths
    // Look for patterns like "Summit: 94 cm" or "snow depth summit 94cm"
    const summitSnowMatch = pageText.match(
      /(?:summit|top|peak)[:\s]*(?:snow\s*(?:depth)?[:\s]*)?([\d.]+)\s*cm/i
    );
    const baseSnowMatch = pageText.match(
      /(?:base|bottom|valley)[:\s]*(?:snow\s*(?:depth)?[:\s]*)?([\d.]+)\s*cm/i
    );

    // Also look for reverse pattern: "94 cm (summit)"
    const summitSnowMatch2 = pageText.match(
      /([\d.]+)\s*cm\s*\(?(?:summit|top|peak)/i
    );
    const baseSnowMatch2 = pageText.match(
      /([\d.]+)\s*cm\s*\(?(?:base|bottom|valley)/i
    );

    if (summitSnowMatch) {
      data.summitDepthInches = cmToInches(parseFloat(summitSnowMatch[1]));
    } else if (summitSnowMatch2) {
      data.summitDepthInches = cmToInches(parseFloat(summitSnowMatch2[1]));
    }

    if (baseSnowMatch) {
      data.baseDepthInches = cmToInches(parseFloat(baseSnowMatch[1]));
    } else if (baseSnowMatch2) {
      data.baseDepthInches = cmToInches(parseFloat(baseSnowMatch2[1]));
    }

    // Look for recent snowfall (24h, 72h, etc.)
    const snow24hMatch = pageText.match(
      /(?:24\s*h(?:ours?)?|last\s*24\s*h(?:ours?)?|today)[:\s]*([\d.]+)\s*cm/i
    );
    const snow72hMatch = pageText.match(
      /(?:72\s*h(?:ours?)?|last\s*72\s*h(?:ours?)?|3\s*days?)[:\s]*([\d.]+)\s*cm/i
    );

    if (snow24hMatch) {
      data.snow24hInches = cmToInches(parseFloat(snow24hMatch[1]));
    }
    if (snow72hMatch) {
      data.snow72hInches = cmToInches(parseFloat(snow72hMatch[1]));
    }

    return data;
  } catch (error) {
    console.error(`Error scraping ${skiresortinfoId}:`, error);
    return null;
  }
}
