import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { favorites, resorts } from "@/db/schema";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ resort_slug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
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

  const { resort_slug } = await params;

  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Find the resort by slug
    const [resort] = await db
      .select({ id: resorts.id })
      .from(resorts)
      .where(eq(resorts.slug, resort_slug))
      .limit(1);

    if (!resort) {
      return NextResponse.json({ error: "Resort not found" }, { status: 404 });
    }

    // Check if already favorited
    const [existingFavorite] = await db
      .select({ id: favorites.id })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, session.user.id),
          eq(favorites.resortId, resort.id)
        )
      )
      .limit(1);

    if (existingFavorite) {
      // Remove favorite
      await db
        .delete(favorites)
        .where(eq(favorites.id, existingFavorite.id));
      return NextResponse.json({ favorited: false });
    } else {
      // Add favorite
      await db.insert(favorites).values({
        userId: session.user.id,
        resortId: resort.id,
      });
      return NextResponse.json({ favorited: true });
    }
  } catch (error) {
    console.error("Failed to toggle favorite:", error);
    return NextResponse.json(
      { error: "Failed to toggle favorite" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ favorited: false });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const { resort_slug } = await params;

  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Find the resort by slug
    const [resort] = await db
      .select({ id: resorts.id })
      .from(resorts)
      .where(eq(resorts.slug, resort_slug))
      .limit(1);

    if (!resort) {
      return NextResponse.json({ favorited: false });
    }

    // Check if favorited
    const [existingFavorite] = await db
      .select({ id: favorites.id })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, session.user.id),
          eq(favorites.resortId, resort.id)
        )
      )
      .limit(1);

    return NextResponse.json({ favorited: !!existingFavorite });
  } catch (error) {
    console.error("Failed to check favorite:", error);
    return NextResponse.json({ favorited: false });
  }
}
