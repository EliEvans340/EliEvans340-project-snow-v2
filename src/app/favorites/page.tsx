import { auth } from "@/auth";

export default async function FavoritesPage() {
  const session = await auth();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-ice-400 mb-2">Your Favorites</h1>
        <p className="text-snow-400 mb-8">
          Welcome, {session?.user?.name || "User"}! Your favorite ski resorts
          will appear here.
        </p>
        <div className="bg-snow-800 rounded-xl p-8 border border-snow-700 text-center">
          <p className="text-snow-400">No favorites yet</p>
          <p className="text-sm text-snow-500 mt-2">
            Browse resorts and add them to your favorites
          </p>
        </div>
      </div>
    </div>
  );
}
