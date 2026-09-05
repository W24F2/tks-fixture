"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, RefreshCw, Zap, Heart, Calendar, X, List, Clock } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  favouriteCount: number;
  onFilterChange: (filter: "all" | "favourites" | "upcoming" | "live" | "past") => void;
  activeFilter: "all" | "favourites" | "upcoming" | "live" | "past";
  upcomingCount: number;
  liveCount: number;
  pastCount: number;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
}

export function Header({
  onRefresh,
  isRefreshing,
  favouriteCount,
  onFilterChange,
  activeFilter,
  upcomingCount,
  liveCount,
  pastCount,
  totalCount,
  searchQuery,
  onSearchChange,
  onClearSearch,
}: HeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filterButtons = [
    { value: "all" as const, label: "All", count: totalCount, icon: List },
    { value: "upcoming" as const, label: "Upcoming", count: upcomingCount, icon: Calendar },
    { value: "live" as const, label: "Live", count: liveCount, icon: Zap },
    { value: "past" as const, label: "Past", count: pastCount, icon: Clock },
    { value: "favourites" as const, label: "Favourites", count: favouriteCount, icon: Heart },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
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
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                Sports Fixtures
              </h1>
              <p className="text-xs text-muted-foreground">Your match schedule</p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center gap-2 max-w-2xl" ref={searchRef}>
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

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1">
              {filterButtons.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.value;
                return (
                  <motion.button
                    key={filter.value}
                    onClick={() => onFilterChange(filter.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                    whileTap={{ scale: 0.95 }}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{filter.label}</span>
                    {filter.count > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-5 w-5 flex items-center justify-center rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: isActive
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(0,0,0,0.08)",
                        }}
                      >
                        {filter.count}
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>

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
      </div>
    </header>
  );
}