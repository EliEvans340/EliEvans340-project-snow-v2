import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { resorts } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    const allResorts = await db
      .select({
        id: resorts.id,
        name: resorts.name,
        slug: resorts.slug,
        state: resorts.state,
        latitude: resorts.latitude,
        longitude: resorts.longitude,
      })
      .from(resorts);

    return NextResponse.json(allResorts);
  } catch (error) {
    console.error("Failed to fetch resorts:", error);
    return NextResponse.json(
      { error: "Failed to fetch resorts" },
      { status: 500 }
    );
  }
}
