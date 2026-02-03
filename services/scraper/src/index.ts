import "dotenv/config";
import express, { Request, Response } from "express";
import { eq, isNotNull, desc } from "drizzle-orm";
import pLimit from "p-limit";
import { db } from "./db.js";
import { resorts, resortOperations, Resort } from "./schema.js";
import { scrapeResort, ScrapedResortData } from "./scraper.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting configuration
const CONCURRENCY = 2;
const DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeAndStore(resort: Resort): Promise<ScrapedResortData | null> {
  if (!resort.skiresortinfoId) {
    return null;
  }

  const data = await scrapeResort(resort.skiresortinfoId);

  if (!data) {
    return null;
  }

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

  return data;
}

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "projectsnow-scraper" });
});

// Get latest operations for a resort
app.get("/api/operations/:resortId", async (req: Request, res: Response) => {
  try {
    const resortId = req.params.resortId as string;

    const [latest] = await db
      .select()
      .from(resortOperations)
      .where(eq(resortOperations.resortId, resortId))
      .orderBy(desc(resortOperations.scrapedAt))
      .limit(1);

    if (!latest) {
      res.status(404).json({ error: "No operations data found for resort" });
      return;
    }

    res.json(latest);
  } catch (error) {
    console.error("Error fetching operations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Trigger scrape for a single resort
app.post("/api/scrape/:skiresortinfoId", async (req: Request, res: Response) => {
  try {
    const skiresortinfoId = req.params.skiresortinfoId as string;

    const [resort] = await db
      .select()
      .from(resorts)
      .where(eq(resorts.skiresortinfoId, skiresortinfoId));

    if (!resort) {
      res.status(404).json({ error: "Resort not found" });
      return;
    }

    const data = await scrapeAndStore(resort);

    if (!data) {
      res.status(500).json({ error: "Failed to scrape resort" });
      return;
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in single scrape:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Trigger full scrape (for cron or manual refresh)
app.post("/api/scrape", async (req: Request, res: Response) => {
  // Verify API key for protected endpoint
  const apiKey = req.headers["x-api-key"];
  if (process.env.SCRAPER_API_KEY && apiKey !== process.env.SCRAPER_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const allResorts = await db
      .select()
      .from(resorts)
      .where(isNotNull(resorts.skiresortinfoId));

    console.log(`Starting scrape for ${allResorts.length} resorts`);

    // Start async scraping (don't wait for completion)
    const scrapePromise = (async () => {
      const limit = pLimit(CONCURRENCY);
      let successCount = 0;
      let failCount = 0;

      const tasks = allResorts.map((resort, index) =>
        limit(async () => {
          if (index > 0) {
            await sleep(DELAY_MS);
          }

          const data = await scrapeAndStore(resort);
          if (data) {
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
    })();

    // Don't await - let it run in background
    scrapePromise.catch((err) => console.error("Scrape error:", err));

    res.json({
      success: true,
      message: `Scrape started for ${allResorts.length} resorts`,
    });
  } catch (error) {
    console.error("Error starting scrape:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Railway cron endpoint
app.get("/api/cron/scrape", async (req: Request, res: Response) => {
  // Verify the request is from Railway cron
  const cronSecret = req.headers["x-railway-cron-secret"];
  if (
    process.env.RAILWAY_CRON_SECRET &&
    cronSecret !== process.env.RAILWAY_CRON_SECRET
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const allResorts = await db
      .select()
      .from(resorts)
      .where(isNotNull(resorts.skiresortinfoId));

    console.log(`[CRON] Starting daily scrape for ${allResorts.length} resorts`);

    // Run synchronously for cron (Railway needs response within timeout)
    const limit = pLimit(CONCURRENCY);
    let successCount = 0;
    let failCount = 0;

    const tasks = allResorts.map((resort, index) =>
      limit(async () => {
        if (index > 0) {
          await sleep(DELAY_MS);
        }

        const data = await scrapeAndStore(resort);
        if (data) {
          successCount++;
        } else {
          failCount++;
        }
      })
    );

    await Promise.all(tasks);

    console.log(
      `[CRON] Scrape complete: ${successCount} succeeded, ${failCount} failed`
    );

    res.json({
      success: true,
      resortsScraped: successCount,
      failed: failCount,
    });
  } catch (error) {
    console.error("[CRON] Error in scrape:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Scraper service running on port ${PORT}`);
});
