import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { favorites, resorts } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    const userFavorites = await db
      .select({
        id: favorites.id,
        resortId: favorites.resortId,
        createdAt: favorites.createdAt,
        resort: {
          id: resorts.id,
          name: resorts.name,
          slug: resorts.slug,
          state: resorts.state,
          latitude: resorts.latitude,
          longitude: resorts.longitude,
        },
      })
      .from(favorites)
      .innerJoin(resorts, eq(favorites.resortId, resorts.id))
      .where(eq(favorites.userId, session.user.id));

    return NextResponse.json(userFavorites);
  } catch (error) {
    console.error("Failed to fetch favorites:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}
