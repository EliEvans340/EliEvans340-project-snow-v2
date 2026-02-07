import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// Revalidate every 1 hour - resort data rarely changes
export const revalidate = 3600;

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Fetch resorts with latest conditions data + snow depth readings
    const allResorts = await sql`
      SELECT
        r.id, r.name, r.slug, r.state, r.latitude, r.longitude,
        c.terrain_open_pct as "terrainOpenPct",
        c.new_snow_24h as "newSnow24h",
        c.snow_depth_summit as "snowDepthSummit",
        c.is_open as "isOpen",
        c.conditions,
        sd.depth_inches as "fallbackDepthInches",
        sd.source as "fallbackSource"
      FROM resorts r
      LEFT JOIN LATERAL (
        SELECT * FROM resort_conditions
        WHERE resort_id = r.id
        ORDER BY scraped_at DESC
        LIMIT 1
      ) c ON true
      LEFT JOIN snow_depth_readings sd ON sd.resort_id = r.id
      WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
      ORDER BY r.name
    `;

    // Add cache headers for CDN/browser caching
    return NextResponse.json(allResorts, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Failed to fetch resorts:", error);
    return NextResponse.json(
      { error: "Failed to fetch resorts" },
      { status: 500 }
    );
  }
}
