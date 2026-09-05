"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "./components/Header";
import { FixtureList } from "./components/FixtureList";
import { LoadingScreen } from "./components/LoadingScreen";
import type { Fixture, FixtureGroup } from "@/types/fixture";
import { api, groupFixturesByDate, clearCache } from "./lib/api";
import { getFavourites, toggleFavourite, isFavourite } from "./lib/favourites";
import { getFixtureStatusInSydney, formatSydneyTime, formatSydneyDate, isPastDate } from "./lib/timezone";
import { Card, CardContent } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { RotateCcw, Info, Search, X, Calendar, Zap, Heart, ChevronDown, Clock } from "lucide-react";

export default function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "favourites" | "upcoming" | "live" | "past">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pastCollapsed, setPastCollapsed] = useState(true);
  const [newEvents, setNewEvents] = useState<Set<number>>(new Set());
  const previousFixturesRef = useRef<Fixture[]>([]);

  const favouriteIds = useMemo(() => new Set(getFavourites()), []);
  
  const refreshFavourites = useCallback(() => {
    setFixtures(prev => [...prev]);
  }, []);

  const mergedFixtures = useMemo(() => {
    const now = new Date();
    return fixtures
      .map((fixture) => {
        const status = getFixtureStatusInSydney(fixture);
        const isFav = favouriteIds.has(fixture.id);
        const isNew = newEvents.has(fixture.id);
        return {
          ...fixture,
          is_favourite: isFav,
          status,
          is_new: isNew,
        };
      })
      .sort((a, b) => {
        if (a.is_favourite !== b.is_favourite) {
          return a.is_favourite ? -1 : 1;
        }
        const dateA = new Date(a.event_date + "T" + (a.event_time || "00:00")).getTime();
        const dateB = new Date(b.event_date + "T" + (b.event_time || "00:00")).getTime();
        return dateA - dateB;
      });
  }, [fixtures, favouriteIds, newEvents]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const fixturesRes = await api.getFixtures();

      if (fixturesRes.error) throw new Error(fixturesRes.error);

      const newFixtures = fixturesRes.data || [];
      
      if (previousFixturesRef.current.length > 0) {
        const prevIds = new Set(previousFixturesRef.current.map(f => f.id));
        const newIds = new Set(newFixtures.map(f => f.id));
        const addedIds = [...newIds].filter(id => !prevIds.has(id));
        if (addedIds.length > 0) {
          setNewEvents(new Set(addedIds));
        }
      }
      
      previousFixturesRef.current = newFixtures;
      setFixtures(newFixtures);
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

  const handleToggleFavourite = useCallback((fixtureId: number) => {
    const newIsFavourite = toggleFavourite(fixtureId);
    if (newIsFavourite) {
      setNewEvents(prev => new Set([...prev, fixtureId]));
    }
    refreshFavourites();
  }, [refreshFavourites]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredFixtures = useMemo(() => {
    let result = mergedFixtures;

    if (filter === "favourites") {
      result = result.filter((f) => f.is_favourite);
    } else if (filter === "upcoming") {
      result = result.filter((f) => f.status === "upcoming");
    } else if (filter === "live") {
      result = result.filter((f) => f.status === "live");
    } else if (filter === "past") {
      result = result.filter((f) => f.status === "completed");
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

  const pastGroups = useMemo(() => {
    const pastFixtures = mergedFixtures.filter(f => isPastDate(f.event_date) && f.status === 'completed');
    return groupFixturesByDate(pastFixtures).reverse();
  }, [mergedFixtures]);

  const upcomingCount = useMemo(() => mergedFixtures.filter((f) => f.status === "upcoming").length, [mergedFixtures]);
  const liveCount = useMemo(() => mergedFixtures.filter((f) => f.status === "live").length, [mergedFixtures]);
  const pastCount = useMemo(() => mergedFixtures.filter((f) => f.status === "completed").length, [mergedFixtures]);
  const totalCount = useMemo(() => mergedFixtures.length, [mergedFixtures]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setFilter("all");
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const clearNewEvents = useCallback(() => {
    setNewEvents(new Set());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        favouriteCount={favouriteIds.size}
        onFilterChange={setFilter}
        activeFilter={filter}
        upcomingCount={upcomingCount}
        liveCount={liveCount}
        pastCount={pastCount}
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

        {!isLoading && !error && (
          <>
            {(filter === "favourites" && groups.length === 0) || (filter !== "all" && filter !== "past" && groups.length === 0) ? (
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
                      ) : filter === "upcoming" ? (
                        <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
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
                        : filter === "upcoming"
                        ? "No upcoming fixtures"
                        : "No fixtures found"}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-6">
                      {filter === "favourites"
                        ? "Tap the heart icon on any fixture to add it here"
                        : filter === "live"
                        ? "Check back when matches are in progress"
                        : filter === "upcoming"
                        ? "All upcoming fixtures will appear here"
                        : searchQuery
                        ? `No fixtures found for "${searchQuery}"`
                        : "No fixtures found"}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => { setFilter("all"); clearSearch(); }}
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
                newEventIds={newEvents}
                onClearNewEvents={clearNewEvents}
              />
            )}

            {filter === "all" && pastGroups.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <motion.button
                  onClick={() => setPastCollapsed(!pastCollapsed)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-lg hover:bg-accent transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Calendar className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Past Matches</h3>
                      <p className="text-sm text-muted-foreground">{pastGroups.length} date{pastGroups.length !== 1 ? 's' : ''} • {pastCount} match{pastCount !== 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: pastCollapsed ? -90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-muted-foreground"
                  >
                    <ChevronDown className="h-5 w-5" aria-hidden="true" />
                  </motion.div>
                </motion.button>

                <AnimatePresence>
                  {!pastCollapsed && (
                    <motion.div
                      key="past-expanded"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 overflow-hidden"
                    >
                      <FixtureList
                        groups={pastGroups}
                        onToggleFavourite={handleToggleFavourite}
                        emptyMessage="No past matches"
                        isPast={true}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}

            {newEvents.size > 0 && filter !== "favourites" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-4 right-4 z-50"
              >
                <Card className="shadow-lg border-primary/30">
                  <CardContent className="p-4 flex items-center gap-3 min-w-[280px]">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">New fixtures added!</p>
                      <p className="text-xs text-muted-foreground">{newEvents.size} new match{newEvents.size !== 1 ? 'es' : ''} since last refresh</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearNewEvents}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </>
        )}

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-12 py-8 border-t text-center"
        >
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
            <span>Last updated</span>
            {lastUpdated && (
              <time dateTime={lastUpdated.toISOString()}>
                {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </time>
            )}
            <span>•</span>
            <span>{mergedFixtures.length} total fixtures</span>
            <span>•</span>
            <span>{favouriteIds.size} favourites</span>
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