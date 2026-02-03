import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { fetchForecast, WeatherApiError } from "@/lib/weather/client";
import { transformHourlyForecasts, transformDailyForecasts } from "@/lib/weather/transform";

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
    const { resorts, forecastSnapshots, hourlyForecasts, dailyForecasts } =
      await getSchema();

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

    const [existingSnapshot] = await db
      .select()
      .from(forecastSnapshots)
      .where(
        and(
          eq(forecastSnapshots.resortId, resort.id),
          eq(forecastSnapshots.model, "open-meteo"),
          gt(forecastSnapshots.expiresAt, new Date())
        )
      )
      .orderBy(forecastSnapshots.fetchedAt)
      .limit(1);

    let snapshot = existingSnapshot;

    if (!snapshot) {
      console.log(`Fetching fresh forecast for resort: ${resort.slug}`);

      const response = await fetchForecast({
        latitude: parseFloat(resort.latitude),
        longitude: parseFloat(resort.longitude),
        timezone: resort.timezone ?? "America/Los_Angeles",
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION_HOURS);

      const [newSnapshot] = await db
        .insert(forecastSnapshots)
        .values({
          resortId: resort.id,
          model: "open-meteo",
          expiresAt,
          rawData: response,
        })
        .returning();

      snapshot = newSnapshot;

      const hourlyData = transformHourlyForecasts(response, snapshot.id);
      const dailyData = transformDailyForecasts(response, snapshot.id);

      await Promise.all([
        db.insert(hourlyForecasts).values(hourlyData),
        db.insert(dailyForecasts).values(dailyData),
      ]);
    }

    const [hourly, daily] = await Promise.all([
      db
        .select()
        .from(hourlyForecasts)
        .where(eq(hourlyForecasts.snapshotId, snapshot.id))
        .orderBy(hourlyForecasts.forecastTime),
      db
        .select()
        .from(dailyForecasts)
        .where(eq(dailyForecasts.snapshotId, snapshot.id))
        .orderBy(dailyForecasts.forecastDate),
    ]);

    return NextResponse.json({
      resort: {
        id: resort.id,
        name: resort.name,
        slug: resort.slug,
      },
      snapshot: {
        id: snapshot.id,
        model: snapshot.model,
        fetchedAt: snapshot.fetchedAt,
        expiresAt: snapshot.expiresAt,
      },
      hourly,
      daily,
    });
  } catch (error) {
    console.error("Forecast API error:", error);

    if (error instanceof WeatherApiError) {
      return NextResponse.json(
        { error: "Weather service unavailable" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
