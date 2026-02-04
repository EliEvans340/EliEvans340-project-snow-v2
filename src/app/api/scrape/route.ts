import { NextResponse } from "next/server";
import { getDb, resorts, resortConditions, resortInfo } from "@/db";
import { scrapeResortConditions } from "@/lib/scraper";
import { isNotNull } from "drizzle-orm";

// Scrape all resorts with skiresortinfoId
async function runFullScrape() {
  const db = getDb();

  const resortsToScrape = await db
    .select({
      id: resorts.id,
      name: resorts.name,
      skiresortinfoId: resorts.skiresortinfoId,
    })
    .from(resorts)
    .where(isNotNull(resorts.skiresortinfoId));

  const today = new Date().toISOString().split("T")[0];
  const results = {
    total: resortsToScrape.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const resort of resortsToScrape) {
    if (!resort.skiresortinfoId) {
      results.skipped++;
      continue;
    }

    try {
      const scraped = await scrapeResortConditions(resort.skiresortinfoId);

      if (!scraped) {
        results.failed++;
        results.errors.push(`${resort.name}: Failed to fetch data`);
        continue;
      }

      await db.insert(resortConditions).values({
        resortId: resort.id,
        scrapedDate: today,
        snowDepthSummit: scraped.conditions.snowDepthSummit,
        snowDepthBase: scraped.conditions.snowDepthBase,
        newSnow24h: scraped.conditions.newSnow24h,
        newSnow48h: scraped.conditions.newSnow48h,
        newSnow7d: scraped.conditions.newSnow7d,
        liftsOpen: scraped.conditions.liftsOpen,
        liftsTotal: scraped.conditions.liftsTotal,
        runsOpen: scraped.conditions.runsOpen,
        runsTotal: scraped.conditions.runsTotal,
        terrainOpenKm: scraped.conditions.terrainOpenKm?.toString(),
        terrainTotalKm: scraped.conditions.terrainTotalKm?.toString(),
        terrainOpenPct: scraped.conditions.terrainOpenPct,
        isOpen: scraped.conditions.isOpen ? 1 : 0,
        seasonStart: scraped.conditions.seasonStart,
        seasonEnd: scraped.conditions.seasonEnd,
        lastSnowfall: scraped.conditions.lastSnowfall,
        conditions: scraped.conditions.conditions,
        firstChair: scraped.conditions.firstChair,
        lastChair: scraped.conditions.lastChair,
      });

      await db
        .insert(resortInfo)
        .values({
          resortId: resort.id,
          elevationBase: scraped.info.elevationBase,
          elevationSummit: scraped.info.elevationSummit,
          verticalDrop: scraped.info.verticalDrop,
          terrainTotalKm: scraped.info.terrainTotalKm?.toString(),
          terrainEasyKm: scraped.info.terrainEasyKm?.toString(),
          terrainIntermediateKm: scraped.info.terrainIntermediateKm?.toString(),
          terrainDifficultKm: scraped.info.terrainDifficultKm?.toString(),
          terrainEasyPct: scraped.info.terrainEasyPct,
          terrainIntermediatePct: scraped.info.terrainIntermediatePct,
          terrainDifficultPct: scraped.info.terrainDifficultPct,
          liftsTotal: scraped.info.liftsTotal,
          runsTotal: scraped.info.runsTotal,
        })
        .onConflictDoUpdate({
          target: resortInfo.resortId,
          set: {
            elevationBase: scraped.info.elevationBase,
            elevationSummit: scraped.info.elevationSummit,
            verticalDrop: scraped.info.verticalDrop,
            terrainTotalKm: scraped.info.terrainTotalKm?.toString(),
            terrainEasyKm: scraped.info.terrainEasyKm?.toString(),
            terrainIntermediateKm: scraped.info.terrainIntermediateKm?.toString(),
            terrainDifficultKm: scraped.info.terrainDifficultKm?.toString(),
            terrainEasyPct: scraped.info.terrainEasyPct,
            terrainIntermediatePct: scraped.info.terrainIntermediatePct,
            terrainDifficultPct: scraped.info.terrainDifficultPct,
            liftsTotal: scraped.info.liftsTotal,
            runsTotal: scraped.info.runsTotal,
            updatedAt: new Date(),
          },
        });

      results.success++;

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      results.failed++;
      results.errors.push(
        `${resort.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return results;
}

// GET /api/scrape - Vercel Cron or single resort test
// Cron: GET /api/scrape (no params)
// Test: GET /api/scrape?resort=vail
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resortSlug = searchParams.get("resort");

  // Single resort test mode
  if (resortSlug) {
    try {
      const scraped = await scrapeResortConditions(resortSlug);
      if (!scraped) {
        return NextResponse.json(
          { error: "Failed to scrape resort" },
          { status: 404 }
        );
      }
      return NextResponse.json(scraped);
    } catch (error) {
      console.error("Scrape error:", error);
      return NextResponse.json(
        { error: "Failed to scrape resort" },
        { status: 500 }
      );
    }
  }

  // Full scrape (Vercel Cron)
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await runFullScrape();
    return NextResponse.json(results);
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/scrape - Manual full scrape trigger
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await runFullScrape();
    return NextResponse.json(results);
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Failed to run scraper" },
      { status: 500 }
    );
  }
}
