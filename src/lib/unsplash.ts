import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { resortPhotos } from "@/db/schema";

const UNSPLASH_API_URL = "https://api.unsplash.com";
const CACHE_DAYS = 7;

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  urls: { raw: string; full: string; regular: string; small: string };
  blur_hash: string | null;
  alt_description: string | null;
  user: {
    name: string;
    links: { html: string };
  };
  links: { html: string };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
}

export interface ResortPhotoResult {
  imageUrl: string;
  blurHash: string | null;
  altDescription: string | null;
  photographerName: string;
  photographerUrl: string;
  unsplashLink: string;
}

async function searchUnsplash(
  query: string,
  apiKey: string
): Promise<UnsplashPhoto | null> {
  const url = `${UNSPLASH_API_URL}/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${apiKey}` },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;

  const data: UnsplashSearchResponse = await res.json();
  return data.results[0] ?? null;
}

async function searchResortPhoto(
  resortName: string,
  state: string
): Promise<UnsplashPhoto | null> {
  const apiKey = process.env.UNSPLASH_API_KEY;
  if (!apiKey) return null;

  // Try resort-specific snowy landscape first
  const photo = await searchUnsplash(`${resortName} snow mountain`, apiKey);
  if (photo) return photo;

  // Fall back to state-level snowy mountain landscape
  return searchUnsplash(`${state} snowy mountain landscape`, apiKey);
}

export async function getResortPhoto(
  resortId: string,
  resortName: string,
  state: string
): Promise<ResortPhotoResult | null> {
  try {
    const db = getDb();

    // Check cache
    const [cached] = await db
      .select()
      .from(resortPhotos)
      .where(
        and(
          eq(resortPhotos.resortId, resortId),
          gt(resortPhotos.expiresAt, new Date())
        )
      )
      .limit(1);

    if (cached) {
      return {
        imageUrl: cached.imageUrl,
        blurHash: cached.blurHash,
        altDescription: cached.altDescription,
        photographerName: cached.photographerName,
        photographerUrl: cached.photographerUrl,
        unsplashLink: cached.unsplashLink,
      };
    }

    // Fetch from Unsplash
    const photo = await searchResortPhoto(resortName, state);
    if (!photo) return null;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_DAYS);

    // Upsert: delete old rows for this resort, then insert
    await db
      .delete(resortPhotos)
      .where(eq(resortPhotos.resortId, resortId));

    await db.insert(resortPhotos).values({
      resortId,
      unsplashId: photo.id,
      imageUrl: photo.urls.full,
      blurHash: photo.blur_hash,
      altDescription: photo.alt_description,
      photographerName: photo.user.name,
      photographerUrl: photo.user.links.html,
      unsplashLink: photo.links.html,
      expiresAt,
    });

    return {
      imageUrl: photo.urls.full,
      blurHash: photo.blur_hash,
      altDescription: photo.alt_description,
      photographerName: photo.user.name,
      photographerUrl: photo.user.links.html,
      unsplashLink: photo.links.html,
    };
  } catch {
    return null;
  }
}
