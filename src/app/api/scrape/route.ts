import { NextResponse } from "next/server";
import { getDb, resorts, resortConditions, resortInfo } from "@/db";
import { scrapeResortConditions } from "@/lib/scraper";
import { isNotNull, sql } from "drizzle-orm";

// POST /api/scrape - Scrape all resorts with skiresortinfoId
// Can be called by a cron job once daily
export async function POST(request: Request) {
  try {
    // Optional: Check for authorization header for cron security
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    // Get all resorts with skiresortinfoId
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

        // Insert conditions
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
        });

        // Upsert resort info (static data)
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
              updatedAt: sql`now()`,
            },
          });

        results.success++;

        // Rate limit: wait 1 second between requests to be nice
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${resort.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Failed to run scraper" },
      { status: 500 }
    );
  }
}

// GET /api/scrape?resort=vail - Scrape a single resort (for testing)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resortSlug = searchParams.get("resort");

  if (!resortSlug) {
    return NextResponse.json(
      { error: "Missing resort parameter" },
      { status: 400 }
    );
  }

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
