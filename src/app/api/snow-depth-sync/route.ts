import { NextResponse } from "next/server";
import { getDb, resorts, snowDepthReadings } from "@/db";
import { eq, isNotNull } from "drizzle-orm";
import { getSnowDepthFallback } from "@/lib/snow-depth";

async function runFullSync() {
  const db = getDb();

  const allResorts = await db
    .select({
      id: resorts.id,
      name: resorts.name,
      slug: resorts.slug,
      state: resorts.state,
      latitude: resorts.latitude,
      longitude: resorts.longitude,
    })
    .from(resorts)
    .where(isNotNull(resorts.latitude));

  const results = {
    total: allResorts.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const resort of allResorts) {
    if (!resort.latitude || !resort.longitude) {
      results.skipped++;
      continue;
    }

    try {
      const lat = parseFloat(resort.latitude);
      const lng = parseFloat(resort.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        results.skipped++;
        continue;
      }

      const depth = await getSnowDepthFallback(lat, lng, resort.state);

      if (!depth) {
        results.skipped++;
        continue;
      }

      // Upsert into snow_depth_readings
      await db
        .insert(snowDepthReadings)
        .values({
          resortId: resort.id,
          depthInches: depth.depthInches,
          source: depth.source,
          sourceDetail: depth.sourceDetail,
          fetchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: snowDepthReadings.resortId,
          set: {
            depthInches: depth.depthInches,
            source: depth.source,
            sourceDetail: depth.sourceDetail,
            fetchedAt: new Date(),
          },
        });

      results.success++;

      // 200ms delay between resorts
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      results.failed++;
      results.errors.push(
        `${resort.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resortSlug = searchParams.get("resort");
  const shouldSave = searchParams.get("save") === "true";

  // Single resort test mode
  if (resortSlug) {
    try {
      const db = getDb();
      const [resort] = await db
        .select()
        .from(resorts)
        .where(eq(resorts.slug, resortSlug))
        .limit(1);

      if (!resort) {
        return NextResponse.json(
          { error: `Resort not found: ${resortSlug}` },
          { status: 404 }
        );
      }

      if (!resort.latitude || !resort.longitude) {
        return NextResponse.json(
          { error: "Resort has no coordinates" },
          { status: 400 }
        );
      }

      const lat = parseFloat(resort.latitude);
      const lng = parseFloat(resort.longitude);
      const depth = await getSnowDepthFallback(lat, lng, resort.state);

      if (!depth) {
        return NextResponse.json({
          resort: resort.name,
          state: resort.state,
          depth: null,
          message: "No snow depth data available from SNOTEL or Open-Meteo",
        });
      }

      if (shouldSave) {
        await db
          .insert(snowDepthReadings)
          .values({
            resortId: resort.id,
            depthInches: depth.depthInches,
            source: depth.source,
            sourceDetail: depth.sourceDetail,
            fetchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: snowDepthReadings.resortId,
            set: {
              depthInches: depth.depthInches,
              source: depth.source,
              sourceDetail: depth.sourceDetail,
              fetchedAt: new Date(),
            },
          });
      }

      return NextResponse.json({
        resort: resort.name,
        state: resort.state,
        depth,
        saved: shouldSave,
      });
    } catch (error) {
      console.error("Snow depth sync error:", error);
      return NextResponse.json(
        { error: "Failed to fetch snow depth" },
        { status: 500 }
      );
    }
  }

  // Full sync (Cron)
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await runFullSync();
    return NextResponse.json(results);
  } catch (error) {
    console.error("Snow depth sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
