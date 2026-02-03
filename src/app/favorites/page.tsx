import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { favorites, resorts } from "@/db/schema";
import Link from "next/link";
import FavoriteButton from "@/components/FavoriteButton";

interface FavoriteWithResort {
  id: string;
  resortId: string;
  createdAt: Date;
  resort: {
    id: string;
    name: string;
    slug: string;
    state: string;
    latitude: string | null;
    longitude: string | null;
  };
}

async function getUserFavorites(
  userId: string
): Promise<FavoriteWithResort[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

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
    .where(eq(favorites.userId, userId));

  return userFavorites;
}

export default async function FavoritesPage() {
  const session = await auth();
  const userFavorites = session?.user?.id
    ? await getUserFavorites(session.user.id)
    : [];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-ice-400 mb-2">Your Favorites</h1>
        <p className="text-snow-400 mb-8">
          Welcome, {session?.user?.name || "User"}! Your favorite ski resorts
          are listed below.
        </p>

        {userFavorites.length === 0 ? (
          <div className="bg-snow-800 rounded-xl p-8 border border-snow-700 text-center">
            <svg
              className="w-12 h-12 text-snow-600 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
            <p className="text-snow-400">No favorites yet</p>
            <p className="text-sm text-snow-500 mt-2">
              Browse resorts and add them to your favorites
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-4 py-2 bg-ice-600 text-white rounded-lg hover:bg-ice-500 transition-colors"
            >
              Explore Resorts
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {userFavorites.map((favorite) => (
              <div
                key={favorite.id}
                className="bg-snow-800 rounded-xl p-6 border border-snow-700 flex items-center justify-between"
              >
                <div className="flex-1">
                  <Link
                    href={`/resort/${favorite.resort.slug}`}
                    className="text-xl font-semibold text-ice-400 hover:text-ice-300 transition-colors"
                  >
                    {favorite.resort.name}
                  </Link>
                  <p className="text-snow-400">{favorite.resort.state}</p>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-snow-500">Base Depth</span>
                      <span className="text-sm font-medium text-snow-300">
                        --
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-snow-500">
                        Summit Depth
                      </span>
                      <span className="text-sm font-medium text-snow-300">
                        --
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-snow-500">Lifts</span>
                      <span className="text-sm font-medium text-snow-300">
                        --/--
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-snow-500">24h Snow</span>
                      <span className="text-sm font-medium text-snow-300">
                        --
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-snow-600 mt-2">
                    Added{" "}
                    {new Date(favorite.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/resort/${favorite.resort.slug}`}
                    className="px-4 py-2 bg-snow-700 text-snow-200 rounded-lg hover:bg-snow-600 transition-colors text-sm"
                  >
                    View Details
                  </Link>
                  <FavoriteButton slug={favorite.resort.slug} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
