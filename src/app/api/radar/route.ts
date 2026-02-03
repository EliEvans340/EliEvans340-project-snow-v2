import { NextResponse } from "next/server";
import { getDb, radarFrames } from "@/db";
import { desc, gte } from "drizzle-orm";

// Fetch radar frames - returns cached frames from last 24 hours
// Also fetches fresh data from RainViewer and caches new frames
export async function GET() {
  try {
    const db = getDb();

    // First, fetch fresh data from RainViewer and cache any new frames
    const rainViewerResponse = await fetch(
      "https://api.rainviewer.com/public/weather-maps.json",
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (rainViewerResponse.ok) {
      const data = await rainViewerResponse.json();
      const newFrames: { frameTime: number; path: string; tileUrl: string }[] = [];

      // Process past frames
      if (data.radar?.past) {
        for (const frame of data.radar.past) {
          newFrames.push({
            frameTime: frame.time,
            path: frame.path,
            tileUrl: `https://tilecache.rainviewer.com${frame.path}/512/{z}/{x}/{y}/6/1_1.png`,
          });
        }
      }

      // Process nowcast frames
      if (data.radar?.nowcast) {
        for (const frame of data.radar.nowcast) {
          newFrames.push({
            frameTime: frame.time,
            path: frame.path,
            tileUrl: `https://tilecache.rainviewer.com${frame.path}/512/{z}/{x}/{y}/6/1_1.png`,
          });
        }
      }

      // Upsert new frames (insert if not exists)
      for (const frame of newFrames) {
        try {
          await db
            .insert(radarFrames)
            .values(frame)
            .onConflictDoNothing({ target: radarFrames.frameTime });
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
    }

    // Get frames from the last 24 hours
    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const frames = await db
      .select({
        time: radarFrames.frameTime,
        url: radarFrames.tileUrl,
      })
      .from(radarFrames)
      .where(gte(radarFrames.frameTime, twentyFourHoursAgo))
      .orderBy(radarFrames.frameTime);

    return NextResponse.json({
      frames,
      count: frames.length,
      oldestFrame: frames[0]?.time,
      newestFrame: frames[frames.length - 1]?.time,
    });
  } catch (error) {
    console.error("Error fetching radar frames:", error);
    return NextResponse.json(
      { error: "Failed to fetch radar frames" },
      { status: 500 }
    );
  }
}

// Cleanup old frames (older than 24 hours) - called periodically
export async function DELETE() {
  try {
    const db = getDb();
    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    // Delete frames older than 24 hours
    // Note: Using raw SQL since Drizzle doesn't have a direct "lt" for deletion
    const result = await db.execute(
      `DELETE FROM radar_frames WHERE frame_time < ${twentyFourHoursAgo}`
    );

    return NextResponse.json({
      message: "Cleanup complete",
      deletedBefore: twentyFourHoursAgo,
    });
  } catch (error) {
    console.error("Error cleaning up radar frames:", error);
    return NextResponse.json(
      { error: "Failed to cleanup radar frames" },
      { status: 500 }
    );
  }
}
