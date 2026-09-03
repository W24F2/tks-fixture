"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Star, Filter, Search, RefreshCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  favouriteCount: number;
  onFilterChange: (filter: "all" | "favourites" | "upcoming" | "live") => void;
  activeFilter: "all" | "favourites" | "upcoming" | "live";
}

const filterOptions = [
  { value: "all", label: "All", icon: null },
  { value: "favourites", label: "Favourites", icon: Star },
  { value: "upcoming", label: "Upcoming", icon: null },
  { value: "live", label: "Live", icon: null },
] as const;

export function Header({
  onRefresh,
  isRefreshing,
  favouriteCount,
  onFilterChange,
  activeFilter,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

          <div className="flex-1 flex items-center justify-center gap-2 max-w-md">
            <motion.div
              ref={searchRef}
              initial={{ opacity: 0, width: 0, padding: 0 }}
              animate={{ opacity: isSearchOpen ? 1 : 0, width: isSearchOpen ? 280 : 0, padding: isSearchOpen ? "0 8px" : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="relative overflow-hidden"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label={isSearchOpen ? "Close search" : "Open search"}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
              {isSearchOpen && (
                <div className="absolute left-10 top-1/2 -translate-y-1/2 w-[260px]">
                  <Input
                    type="search"
                    placeholder="Search fixtures..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-sm bg-transparent"
                    aria-label="Search fixtures"
                    autoFocus
                  />
                </div>
              )}
            </motion.div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              ref={menuRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="relative h-9 w-9 sm:h-10 sm:w-36 rounded-lg bg-muted flex items-center justify-center gap-2 text-sm font-medium transition-colors hover:bg-accent"
              aria-expanded={isMenuOpen}
              aria-haspopup="listbox"
              aria-label="Filter fixtures"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}</span>
              <motion.span
                animate={{ rotate: isMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="h-3 w-3"
              >
                ▼
              </motion.span>
            </motion.button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute right-0 mt-2 w-48 rounded-md border bg-popover p-1 shadow-lg"
                  role="listbox"
                >
                  {filterOptions.map((filter) => (
                    <motion.button
                      key={filter.value}
                      onClick={() => {
                        onFilterChange(filter.value as typeof activeFilter);
                        setIsMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors",
                        activeFilter === filter.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      role="option"
                      aria-selected={activeFilter === filter.value}
                    >
                      {filter.icon && <filter.icon className="h-4 w-4" aria-hidden="true" />}
                      {filter.label}
                      {filter.value === "favourites" && favouriteCount > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto h-5 w-5 flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-medium"
                        >
                          {favouriteCount}
                        </motion.span>
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

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