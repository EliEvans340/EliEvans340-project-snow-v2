import "dotenv/config";
import { eq, isNotNull } from "drizzle-orm";
import pLimit from "p-limit";
import { db } from "./db.js";
import { resorts, resortOperations, Resort } from "./schema.js";
import { scrapeResort, ScrapedResortData } from "./scraper.js";

// Rate limiting: max 2 concurrent requests, with delay between requests
const CONCURRENCY = 2;
const DELAY_MS = 2000; // 2 seconds between requests

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeAndStore(resort: Resort): Promise<boolean> {
  if (!resort.skiresortinfoId) {
    console.log(`  Skipping ${resort.name}: no skiresortinfo ID`);
    return false;
  }

  console.log(`  Scraping ${resort.name} (${resort.skiresortinfoId})...`);

  const data = await scrapeResort(resort.skiresortinfoId);

  if (!data) {
    console.log(`  Failed to scrape ${resort.name}`);
    return false;
  }

  // Store in database
  await db.insert(resortOperations).values({
    resortId: resort.id,
    liftsTotal: data.liftsTotal,
    liftsOpen: data.liftsOpen,
    runsTotal: data.runsTotal,
    runsOpen: data.runsOpen,
    skiableKm: data.skiableKm?.toString() ?? null,
    difficultyEasy: data.difficultyEasy,
    difficultyIntermediate: data.difficultyIntermediate,
    difficultyAdvanced: data.difficultyAdvanced,
    baseDepthInches: data.baseDepthInches?.toString() ?? null,
    summitDepthInches: data.summitDepthInches?.toString() ?? null,
    snow24hInches: data.snow24hInches?.toString() ?? null,
    snow72hInches: data.snow72hInches?.toString() ?? null,
  });

  console.log(`  Stored data for ${resort.name}`);
  return true;
}

async function scrapeAllResorts(): Promise<void> {
  console.log("Starting full resort scrape...");

  // Get all resorts with skiresortinfo IDs
  const allResorts = await db
    .select()
    .from(resorts)
    .where(isNotNull(resorts.skiresortinfoId));

  console.log(`Found ${allResorts.length} resorts with skiresortinfo IDs`);

  const limit = pLimit(CONCURRENCY);
  let successCount = 0;
  let failCount = 0;

  // Process with rate limiting
  const tasks = allResorts.map((resort, index) =>
    limit(async () => {
      // Add delay to be respectful
      if (index > 0) {
        await sleep(DELAY_MS);
      }

      const success = await scrapeAndStore(resort);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    })
  );

  await Promise.all(tasks);

  console.log(
    `Scrape complete: ${successCount} succeeded, ${failCount} failed`
  );
}

async function scrapeSingleResort(skiresortinfoId: string): Promise<void> {
  console.log(`Scraping single resort: ${skiresortinfoId}`);

  // Find the resort
  const [resort] = await db
    .select()
    .from(resorts)
    .where(eq(resorts.skiresortinfoId, skiresortinfoId));

  if (!resort) {
    console.error(`Resort not found with skiresortinfo ID: ${skiresortinfoId}`);
    process.exit(1);
  }

  const success = await scrapeAndStore(resort);
  if (!success) {
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.includes("--single")) {
  const idIndex = args.indexOf("--single");
  const skiresortinfoId = args[idIndex + 1];

  if (!skiresortinfoId) {
    console.error("Usage: npm run scrape:single -- --single <skiresortinfo-id>");
    process.exit(1);
  }

  scrapeSingleResort(skiresortinfoId);
} else {
  scrapeAllResorts();
}
