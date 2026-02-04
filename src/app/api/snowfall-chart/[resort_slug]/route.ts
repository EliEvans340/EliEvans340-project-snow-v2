import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { fetchAllModels, MultiModelResponse } from "@/lib/weather/multi-model-client";

const CACHE_DURATION_HOURS = 1;

interface RouteParams {
  params: Promise<{ resort_slug: string }>;
}

async function getDb() {
  const { db } = await import("@/db");
  return db;
}

async function getSchema() {
  const schema = await import("@/db/schema");
  return schema;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { resort_slug } = await params;
    const db = await getDb();
    const { resorts, forecastSnapshots } = await getSchema();

    // Get resort
    const [resort] = await db
      .select()
      .from(resorts)
      .where(eq(resorts.slug, resort_slug))
      .limit(1);

    if (!resort) {
      return NextResponse.json({ error: "Resort not found" }, { status: 404 });
    }

    if (!resort.latitude || !resort.longitude) {
      return NextResponse.json(
        { error: "Resort coordinates not available" },
        { status: 400 }
      );
    }

    // Check for cached multi-model data
    const [existingSnapshot] = await db
      .select()
      .from(forecastSnapshots)
      .where(
        and(
          eq(forecastSnapshots.resortId, resort.id),
          eq(forecastSnapshots.model, "multi-model"),
          gt(forecastSnapshots.expiresAt, new Date())
        )
      )
      .orderBy(forecastSnapshots.fetchedAt)
      .limit(1);

    let multiModelData: MultiModelResponse;

    if (existingSnapshot?.rawData) {
      // Use cached data
      multiModelData = existingSnapshot.rawData as unknown as MultiModelResponse;
    } else {
      // Fetch fresh data from all models
      console.log(`Fetching multi-model forecast for resort: ${resort.slug}`);

      const lat = parseFloat(resort.latitude);
      const lng = parseFloat(resort.longitude);

      multiModelData = await fetchAllModels(lat, lng);

      // Cache the result
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION_HOURS);

      await db.insert(forecastSnapshots).values({
        resortId: resort.id,
        model: "multi-model",
        expiresAt,
        rawData: multiModelData as unknown as Record<string, unknown>,
      });
    }

    return NextResponse.json({
      resort: {
        id: resort.id,
        name: resort.name,
        slug: resort.slug,
      },
      ...multiModelData,
    });
  } catch (error) {
    console.error("Snowfall chart API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
