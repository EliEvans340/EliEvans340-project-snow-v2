"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface FavoriteButtonProps {
  slug: string;
  className?: string;
}

export default function FavoriteButton({
  slug,
  className = "",
}: FavoriteButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkFavorite() {
      if (status === "loading") return;
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/favorites/${slug}`);
        if (response.ok) {
          const data = await response.json();
          setFavorited(data.favorited);
        }
      } catch (error) {
        console.error("Error checking favorite status:", error);
      } finally {
        setLoading(false);
      }
    }
    checkFavorite();
  }, [slug, session, status]);

  async function toggleFavorite() {
    if (!session) {
      router.push(`/auth/signin?callbackUrl=/resort/${slug}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/favorites/${slug}`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setFavorited(data.favorited);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
        favorited
          ? "bg-ice-600/20 border-ice-500 text-ice-400"
          : "bg-snow-800 border-snow-600 text-snow-300 hover:border-ice-500 hover:text-ice-400"
      } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <svg
        className={`w-5 h-5 ${favorited ? "fill-ice-400" : "fill-none"}`}
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
      <span className="text-sm font-medium">
        {loading ? "..." : favorited ? "Favorited" : "Add to Favorites"}
      </span>
    </button>
  );
}
