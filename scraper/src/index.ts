import "dotenv/config";
import { isNotNull } from "drizzle-orm";
import { getDb, resorts, resortConditions, resortInfo } from "./db";
import { scrapeResortConditions } from "./scraper";

async function runFullScrape() {
  console.log("=".repeat(60));
  console.log("ProjectSnow Scraper - Starting full scrape");
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

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

  console.log(`Found ${resortsToScrape.length} resorts to scrape\n`);

  const today = new Date().toISOString().split("T")[0];
  const results = {
    total: resortsToScrape.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < resortsToScrape.length; i++) {
    const resort = resortsToScrape[i];
    const progress = `[${i + 1}/${resortsToScrape.length}]`;

    if (!resort.skiresortinfoId) {
      console.log(`${progress} SKIP: ${resort.name} - No skiresortinfoId`);
      results.skipped++;
      continue;
    }

    try {
      console.log(`${progress} Scraping: ${resort.name}...`);
      const scraped = await scrapeResortConditions(resort.skiresortinfoId);

      if (!scraped) {
        console.log(`${progress} FAIL: ${resort.name} - No data returned`);
        results.failed++;
        results.errors.push(`${resort.name}: Failed to fetch data`);
        continue;
      }

      // Insert conditions (new row each time)
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

      // Upsert resort info
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
          liftsGondolas: scraped.info.liftsGondolas,
          liftsChairliftsHighSpeed: scraped.info.liftsChairliftsHighSpeed,
          liftsChairliftsFixedGrip: scraped.info.liftsChairliftsFixedGrip,
          liftsSurface: scraped.info.liftsSurface,
          liftsCarpets: scraped.info.liftsCarpets,
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
            liftsGondolas: scraped.info.liftsGondolas,
            liftsChairliftsHighSpeed: scraped.info.liftsChairliftsHighSpeed,
            liftsChairliftsFixedGrip: scraped.info.liftsChairliftsFixedGrip,
            liftsSurface: scraped.info.liftsSurface,
            liftsCarpets: scraped.info.liftsCarpets,
            runsTotal: scraped.info.runsTotal,
            updatedAt: new Date(),
          },
        });

      const snowInfo = scraped.conditions.snowDepthSummit
        ? `${scraped.conditions.snowDepthSummit}cm`
        : "no snow data";
      console.log(`${progress} OK: ${resort.name} (${snowInfo})`);
      results.success++;

      // Rate limiting - 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.log(`${progress} ERROR: ${resort.name} - ${errorMsg}`);
      results.failed++;
      results.errors.push(`${resort.name}: ${errorMsg}`);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("SCRAPE COMPLETE");
  console.log("=".repeat(60));
  console.log(`End time: ${new Date().toISOString()}`);
  console.log(`Total resorts: ${results.total}`);
  console.log(`  Success: ${results.success}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Skipped: ${results.skipped}`);

  if (results.errors.length > 0) {
    console.log(`\nErrors (${results.errors.length}):`);
    results.errors.slice(0, 20).forEach((err) => console.log(`  - ${err}`));
    if (results.errors.length > 20) {
      console.log(`  ... and ${results.errors.length - 20} more`);
    }
  }

  return results;
}

// Run the scraper
runFullScrape()
  .then((results) => {
    console.log("\nScraper finished successfully");
    process.exit(results.failed > results.success ? 1 : 0);
  })
  .catch((error) => {
    console.error("Scraper failed with error:", error);
    process.exit(1);
  });
