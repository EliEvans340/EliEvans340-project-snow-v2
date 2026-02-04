"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Resort {
  id: string;
  name: string;
  slug: string;
  state: string;
}

export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Resort[]>([]);
  const [allResorts, setAllResorts] = useState<Resort[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch resorts on mount
  useEffect(() => {
    async function fetchResorts() {
      try {
        const response = await fetch("/api/resorts");
        if (response.ok) {
          const data = await response.json();
          setAllResorts(data);
        }
      } catch (error) {
        console.error("Failed to fetch resorts:", error);
      }
    }
    fetchResorts();
  }, []);

  // Filter results when query changes
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const filtered = allResorts
      .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
    setResults(filtered);
    setIsOpen(filtered.length > 0);
    setSelectedIndex(-1);
  }, [query, allResorts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      router.push(`/resort/${results[selectedIndex].slug}`);
      setQuery("");
      setIsOpen(false);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-snow-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search resorts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          className="w-48 sm:w-64 pl-9 pr-3 py-1.5 bg-snow-800 border border-snow-700 rounded-lg text-snow-100 placeholder-snow-500 focus:outline-none focus:border-ice-500 focus:ring-1 focus:ring-ice-500 text-sm"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-snow-800 border border-snow-700 rounded-lg shadow-lg overflow-hidden z-50"
        >
          {results.map((resort, index) => (
            <Link
              key={resort.id}
              href={`/resort/${resort.slug}`}
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className={`block px-3 py-2 text-sm transition-colors ${
                index === selectedIndex
                  ? "bg-ice-500/20 text-ice-400"
                  : "text-snow-100 hover:bg-snow-700"
              }`}
            >
              <span className="font-medium">{resort.name}</span>
              <span className="text-snow-500 ml-2">{resort.state}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
