import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

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

    // Use raw SQL to avoid any ORM limits
    const allResorts = await sql`
      SELECT id, name, slug, state, latitude, longitude, skiresortinfo_id as "skiresortinfoId"
      FROM resorts
      ORDER BY name
    `;

    return NextResponse.json(allResorts);
  } catch (error) {
    console.error("Failed to fetch resorts:", error);
    return NextResponse.json(
      { error: "Failed to fetch resorts" },
      { status: 500 }
    );
  }
}
