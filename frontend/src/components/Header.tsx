"use client";

import { motion } from "framer-motion";
import { Search, RefreshCw, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export type Filter = "all" | "favourites" | "upcoming" | "live" | "past";

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onFilterChange: (filter: Filter) => void;
  activeFilter: Filter;
  favouriteCount: number;
  upcomingCount: number;
  liveCount: number;
  pastCount: number;
}

// PERF/ACCESSIBILITY: tab bar restored. Clicking a tab filters the main list;
// the active tab is reflected for keyboard/AT users via aria-current.
const FILTER_TABS: { key: Filter; label: string; count?: keyof HeaderProps }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming", count: "upcomingCount" },
  { key: "live", label: "Live", count: "liveCount" },
  { key: "favourites", label: "Favourites", count: "favouriteCount" },
  { key: "past", label: "Past", count: "pastCount" },
];

export function Header({
  onRefresh,
  isRefreshing,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onFilterChange,
  activeFilter,
  favouriteCount,
  upcomingCount,
  liveCount,
  pastCount,
}: HeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const counts: Record<string, number> = {
    favouriteCount,
    upcomingCount,
    liveCount,
    pastCount,
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap h-16 items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-3 shrink-0">
            {/* PERF/ACCESSIBILITY: plays once on mount — no tab re-renders to replay it. */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </motion.div>
            <div className="hidden sm:block">
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                Sports Fixtures
              </h1>
              <p className="text-xs text-muted-foreground">Your match schedule</p>
            </div>
          </div>

          <div className="w-full md:flex-1 md:w-auto flex items-center justify-center gap-2 max-w-md" ref={searchRef}>
            <div className="relative w-full max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  placeholder="Search team, location, sport..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 100)}
                  className="h-10 pl-10 pr-10 text-sm bg-background"
                  aria-label="Search fixtures"
                />
                {searchQuery && (
                  <motion.button
                    onClick={onClearSearch}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end md:justify-start">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh fixtures"
              className="h-9 w-9"
            >
              <motion.div
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </motion.div>
            </Button>
          </div>
        </div>

        {/* Filter tabs — restored. ARIA group + aria-current for screen readers. */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 -mb-px" role="group" aria-label="Filter fixtures">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count = tab.count ? counts[tab.count] : undefined;
            return (
              <button
                key={tab.key}
                onClick={() => onFilterChange(tab.key)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative whitespace-nowrap px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {tab.label}
                {count !== undefined && (
                  <span className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-xs",
                    isActive ? "bg-primary-foreground/20" : "bg-muted"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

// Local className joiner (avoids pulling the full tailwind-merge just for this).
function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
