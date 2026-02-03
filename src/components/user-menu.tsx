"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-snow-700 animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className="px-4 py-2 rounded-lg bg-ice-600 text-white hover:bg-ice-500 transition-colors text-sm font-medium"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-ice-500 transition-all"
      >
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User avatar"}
            width={32}
            height={32}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-ice-600 flex items-center justify-center text-white text-sm font-medium">
            {session.user.name?.[0] || session.user.email?.[0] || "U"}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg bg-snow-800 border border-snow-700 shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-snow-700">
            <p className="text-sm font-medium text-snow-100 truncate">
              {session.user.name}
            </p>
            <p className="text-xs text-snow-400 truncate">
              {session.user.email}
            </p>
          </div>
          <Link
            href="/favorites"
            className="block px-4 py-2 text-sm text-snow-200 hover:bg-snow-700 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Favorites
          </Link>
          <Link
            href="/account"
            className="block px-4 py-2 text-sm text-snow-200 hover:bg-snow-700 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Account
          </Link>
          <button
            onClick={() => signOut()}
            className="w-full text-left px-4 py-2 text-sm text-snow-200 hover:bg-snow-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
