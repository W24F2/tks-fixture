"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "./components/Header";
import { FixtureList } from "./components/FixtureList";
import { LoadingScreen } from "./components/LoadingScreen";
import type { Fixture, FavouriteResponse } from "@/types/fixture";
import { api, groupFixturesByDate } from "./lib/api";
import { Card, CardContent } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { Badge } from "./components/ui/Badge";
import { RotateCcw, Info, Search, X } from "lucide-react";

export default function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [favourites, setFavourites] = useState<FavouriteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "favourites" | "upcoming" | "live">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const favouriteIds = useMemo(() => new Set(favourites.map((f) => f.fixture_id)), [favourites]);

  const mergedFixtures = useMemo(() => 
    fixtures
      .map((fixture) => ({
        ...fixture,
        is_favourite: favouriteIds.has(fixture.id),
      }))
      .sort((a, b) => {
        // Favourites first
        if (a.is_favourite !== b.is_favourite) {
          return a.is_favourite ? -1 : 1;
        }
        // Then by date/time
        const dateA = new Date(a.event_date + "T" + (a.event_time || "00:00")).getTime();
        const dateB = new Date(b.event_date + "T" + (b.event_time || "00:00")).getTime();
        return dateA - dateB;
      }), 
  [fixtures, favouriteIds]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [fixturesRes, favouritesRes] = await Promise.all([
        api.getFixtures(),
        api.getFavourites(),
      ]);

      if (fixturesRes.error) throw new Error(fixturesRes.error);
      if (favouritesRes.error) throw new Error(favouritesRes.error);

      setFixtures(fixturesRes.data || []);
      setFavourites(favouritesRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fixtures");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await api.refreshFixtures();
      if (res.error) throw new Error(res.error);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
      setIsRefreshing(false);
    }
  }, [loadData]);

  const handleToggleFavourite = useCallback(async (fixtureId: number, isFavourite: boolean) => {
    if (isFavourite) {
      const res = await api.removeFavourite(fixtureId);
      if (!res.error) {
        setFavourites((prev) => prev.filter((f) => f.fixture_id !== fixtureId));
      }
    } else {
      const res = await api.addFavourite(fixtureId);
      if (res.data) {
        setFavourites((prev) => [...prev, res.data!]);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter fixtures based on filter and search
  const filteredFixtures = useMemo(() => {
    let result = mergedFixtures;

    if (filter === "favourites") {
      result = result.filter((f) => f.is_favourite);
    } else if (filter === "upcoming") {
      result = result.filter((f) => f.status === "upcoming");
    } else if (filter === "live") {
      result = result.filter((f) => f.status === "live");
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) =>
        f.title.toLowerCase().includes(query) ||
        f.opposition?.toLowerCase().includes(query) ||
        f.team?.toLowerCase().includes(query) ||
        f.location?.toLowerCase().includes(query) ||
        f.sport?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [mergedFixtures, filter, searchQuery]);

  const groups = useMemo(() => groupFixturesByDate(filteredFixtures), [filteredFixtures]);

  const upcomingCount = useMemo(() => mergedFixtures.filter((f) => f.status === "upcoming").length, [mergedFixtures]);
  const liveCount = useMemo(() => mergedFixtures.filter((f) => f.status === "live").length, [mergedFixtures]);
  const totalCount = useMemo(() => mergedFixtures.length, [mergedFixtures]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setFilter("all"); // Reset filter when searching
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        favouriteCount={favourites.length}
        onFilterChange={setFilter}
        activeFilter={filter}
        upcomingCount={upcomingCount}
        liveCount={liveCount}
        totalCount={totalCount}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
      />

      <main className="container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <LoadingScreen key="loading" />
          ) : error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3"
              role="alert"
            >
              <Info className="h-5 w-5 text-destructive flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-destructive flex-1">{error}</p>
              <Button variant="ghost" size="sm" onClick={handleRefresh}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Retry
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {groups.length === 0 && filter !== "all" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4"
          >
            <Card className="max-w-md mx-auto">
              <CardContent className="py-12 px-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  {filter === "favourites" ? (
                    <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  ) : filter === "live" ? (
                    <svg className="h-8 w-8 text-green-500 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                  ) : (
                    <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {filter === "favourites"
                    ? "No favourites yet"
                    : filter === "live"
                    ? "No live matches"
                    : "No upcoming fixtures"}
                </h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {filter === "favourites"
                    ? "Tap the heart icon on any fixture to add it here"
                    : filter === "live"
                    ? "Check back when matches are in progress"
                    : "All upcoming fixtures will appear here"}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setFilter("all")}
                  className="w-full sm:w-auto"
                >
                  <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Show all fixtures
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <FixtureList
            groups={groups}
            onToggleFavourite={handleToggleFavourite}
            emptyMessage={filter === "favourites" ? "No favourite fixtures yet" : searchQuery ? `No fixtures found for "${searchQuery}"` : "No fixtures found"}
          />
        )}

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-12 py-8 border-t text-center"
        >
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <span>Last updated</span>
            {lastUpdated && (
              <time dateTime={lastUpdated.toISOString()}>
                {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </time>
            )}
            <span>•</span>
            <span>{mergedFixtures.length} total fixtures</span>
            <span>•</span>
            <span>{favourites.length} favourites</span>
            {searchQuery && (
              <>
                <span>•</span>
                <span>{filteredFixtures.length} results</span>
              </>
            )}
          </p>
        </motion.footer>
      </main>
    </div>
  );
}