"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header, type Filter } from "./components/Header";
import { FixtureList } from "./components/FixtureList";
import { LoadingScreen } from "./components/LoadingScreen";
import { LegalNotice, type LegalMode } from "./components/LegalNotice";
import { InstallPrompt } from "./components/InstallPrompt";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { acceptTerms, hasAcceptedCurrentTerms } from "./lib/consent";
import type { Fixture, FixtureGroup } from "@/types/fixture";
import { api, groupFixturesByDate, clearCache, groupFixturesWithFavouritesFirst } from "./lib/api";
import { getFavourites, toggleFavourite, isFavourite } from "./lib/favourites";
import { getFixtureStatusInSydney, formatSydneyTime, formatSydneyDate, isPastDate } from "./lib/timezone";
import { fadeUp, fadeIn, EASE, EASE_IN_OUT, DURATION } from "@/lib/motion";
import { skipWaiting, onUpdateAvailableCb } from "./lib/pwa";
import { subscribeToPush, unsubscribePush, getAlertLevel, setAlertLevel, isPushSupported, type AlertLevel } from "./lib/push-notifications";
import { getCachedFixtures, saveFixtures } from "./lib/db";
import { Card, CardContent } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import {
  RotateCcw, Info, Search, X, Calendar, Zap, Heart, ChevronDown,
  Clock, Bell, BellOff, Download, WifiOff, Wifi,
} from "lucide-react";

export default function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tabs are back (Past / Upcoming / Favourites, plus All & Live). Default to
  // "upcoming" per request — the Upcoming tab is highlighted on load.
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  // PERF/A11Y: defer the search term so typing stays responsive. The heavy
  // filter/grouping work runs against a "stale" value while the user is still
  // keying, keeping the input at 60fps even with many fixtures.
  const deferredQuery = useDeferredValue(searchQuery);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pastCollapsed, setPastCollapsed] = useState(true);
  const [newEvents, setNewEvents] = useState<Set<number>>(new Set());
  const previousFixturesRef = useRef<Fixture[]>([]);
  // Track the last known content hash. When unchanged we skip the full data
  // fetch entirely, saving the ~10-50 KB payload on every poll cycle.
  // Using a ref avoids stale-closure issues in the useCallback.
  const lastHashRef = useRef<string | null>(null);

  // ---- PWA state ----
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [usingCachedFixtures, setUsingCachedFixtures] = useState(false);
  const [pushSupported, setPushSupported] = useState(isPushSupported());
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [alertLevel, setAlertLevelState] = useState<AlertLevel>('all');

  // LEGAL: first-visit disclaimer/terms gate. `legalMode` distinguishes the
  // blocking first-visit gate from the footer-triggered review dialog.
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalMode, setLegalMode] = useState<LegalMode>("gate");

  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(() => new Set(getFavourites()));
  
  const refreshFavourites = useCallback(() => {
    setFavouriteIds(new Set(getFavourites()));
    setFixtures(prev => [...prev]);
  }, []);
  
  useEffect(() => {
    const handleStorage = () => {
      setFavouriteIds(new Set(getFavourites()));
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('sf-favourites-changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('sf-favourites-changed', handleStorage);
    };
  }, []);

  // LEGAL: prompt on first visit (or when the terms version changes), since
  // acceptance is versioned in localStorage. No login is required by the app.
  useEffect(() => {
    if (!hasAcceptedCurrentTerms()) {
      setLegalMode("gate");
      setLegalOpen(true);
    }
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

      // STEP 0: If offline, try to load from IndexedDB cache so the UI
      // never shows a blank screen. We still do the hash check in
      // background to refresh when back online.
      const isNowOffline = !navigator.onLine;
      if (isNowOffline && previousFixturesRef.current.length > 0) {
        setUsingCachedFixtures(true);
        // Brief loading state so the user knows data is being restored
        setIsLoading(true);
        try {
          const cached = await getCachedFixtures() as Fixture[];
          if (cached && cached.length > 0) {
            previousFixturesRef.current = cached;
            setFixtures(cached);
            setLastUpdated(new Date());
            // Update lastHash from cache metadata if available
            return;
          }
        } catch {
          // Cache unavailable — fall through to error
        }
      }

      // STEP 1: Lightweight hash check (~40 bytes response).
      const hashRes = await api.checkHash();
      if (hashRes.error) {
        // If network failed (offline), try to serve cached fixtures
        if (isNowOffline) {
          try {
            const cached = await getCachedFixtures() as Fixture[];
            if (cached && cached.length > 0) {
              setUsingCachedFixtures(true);
              previousFixturesRef.current = cached;
              setFixtures(cached);
              setLastUpdated(new Date());
              return;
            }
          } catch { /* ignore */ }
        }
        throw new Error(hashRes.error);
      }

      const currentHash = hashRes.data?.hash;

      // STEP 2: If data is unchanged, skip the full payload fetch.
      // The UI keeps the already-rendered fixtures; save the ~10-50 KB body.
      if (currentHash && currentHash === lastHashRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // STEP 3: Hash differs (or this is the first load) — fetch full data.
      const fixturesRes = await api.getFixtures();
      if (fixturesRes.error) {
        // If network failed (offline), try to serve cached fixtures
        if (isNowOffline) {
          try {
            const cached = await getCachedFixtures() as Fixture[];
            if (cached && cached.length > 0) {
              setUsingCachedFixtures(true);
              previousFixturesRef.current = cached;
              setFixtures(cached);
              setLastUpdated(new Date());
              return;
            }
          } catch { /* ignore */ }
        }
        throw new Error(fixturesRes.error);
      }

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
      if (currentHash) lastHashRef.current = currentHash;
      setUsingCachedFixtures(false);

      // Cache fixtures in IndexedDB for offline access
      if (newFixtures.length > 0) {
        try { saveFixtures(newFixtures); } catch { /* ignore */ }
      }
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

    if (deferredQuery.trim()) {
      const query = deferredQuery.toLowerCase().trim();
      result = result.filter((f) =>
        f.title.toLowerCase().includes(query) ||
        f.opposition?.toLowerCase().includes(query) ||
        f.team?.toLowerCase().includes(query) ||
        f.location?.toLowerCase().includes(query) ||
        f.sport?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [mergedFixtures, filter, deferredQuery]);

  const groups = useMemo(() => groupFixturesWithFavouritesFirst(filteredFixtures), [filteredFixtures]);

  const pastGroups = useMemo(() => {
    const pastFixtures = mergedFixtures.filter(f => isPastDate(f.event_date) && f.status === 'completed');
    return groupFixturesByDate(pastFixtures).reverse();
  }, [mergedFixtures]);

  const upcomingCount = useMemo(() => mergedFixtures.filter((f) => f.status === "upcoming").length, [mergedFixtures]);
  const liveCount = useMemo(() => mergedFixtures.filter((f) => f.status === "live").length, [mergedFixtures]);
  // pastCount is shown in the "Past Matches" collapsible label (All view only).
  const pastCount = useMemo(() => mergedFixtures.filter((f) => f.status === "completed").length, [mergedFixtures]);
  const favouriteCount = favouriteIds.size;

  // PERF: search filters within the active tab (no reset to "all") — keeps the
  // tab the user selected as the scope for the query.
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const clearNewEvents = useCallback(() => {
    setNewEvents(new Set());
  }, []);

  // ---- PWA handlers ----

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Reload data when back online
      loadData();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Subscribe SW update callbacks
  useEffect(() => {
    onUpdateAvailableCb(() => setUpdateAvailable(true));
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        setAlertLevelState(getAlertLevel());
      } catch {
        // ignore — SW may not be registered yet
      }
    };
    checkPermission();
  }, []);

  // Push notification: subscribe button handler
  const handleSubscribePush = useCallback(async () => {
    try {
      await subscribeToPush(alertLevel);
      setNotificationGranted(true);
    } catch {
      // Permission denied or not supported
      setNotificationGranted(false);
    }
  }, [alertLevel]);

  // Push notification: unsubscribe handler
  const handleUnsubscribePush = useCallback(async () => {
    try {
      await unsubscribePush();
      setNotificationGranted(false);
    } catch {
      // ignore
    }
  }, []);

  // Push notification: cycle alert level
  const handleCycleAlerts = useCallback(() => {
    const levels: AlertLevel[] = ['none', 'live', 'all'];
    const nextIndex = (levels.indexOf(alertLevel) + 1) % levels.length;
    const next = levels[nextIndex];
    setAlertLevelState(next);
    setAlertLevel(next);

    if (next === 'none') {
      handleUnsubscribePush();
    } else {
      handleSubscribePush();
    }
  }, [alertLevel, handleSubscribePush, handleUnsubscribePush]);

  // Download latest version (skip waiting + reload)
  const handleDownloadUpdate = useCallback(async () => {
    await skipWaiting();
    setUpdateAvailable(false);
  }, []);

  // LEGAL: persist acceptance locally and dismiss the gate.
  const handleAcceptTerms = useCallback(() => {
    acceptTerms();
    setLegalOpen(false);
  }, []);

  const openLegalNotice = useCallback(() => {
    setLegalMode("review");
    setLegalOpen(true);
  }, []);

  const closeLegalNotice = useCallback(() => {
    setLegalOpen(false);
  }, []);

  // LEGAL: while the first-visit gate is up, everything behind it is made inert
  // (and hidden from assistive tech) so only the dialog is reachable.
  const legalGateActive = legalOpen && legalMode === "gate";

  return (
    <>
    {/* PWA: Offline indicator — shows at top of viewport */}
    <OfflineIndicator
      usingCache={usingCachedFixtures}
      onRefresh={loadData}
      dismissed={isOffline}
      onDismiss={() => {}}
    />

    <div
      className="min-h-screen bg-background"
      aria-hidden={legalGateActive || undefined}
      {...(legalGateActive ? { inert: true } : {})}
    >
      {/* A11Y: keyboard/AT users can jump straight to the content, skipping the header. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:no-underline"
      >
        Skip to content
      </a>

              <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        onFilterChange={setFilter}
        activeFilter={filter}
        favouriteCount={favouriteCount}
        upcomingCount={upcomingCount}
        liveCount={liveCount}
        pastCount={pastCount}
      />

      <main id="main-content" className="container mx-auto px-4 py-6" tabIndex={-1}>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <LoadingScreen key="loading" />
          ) : error && (
            <motion.div
              key="error"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: DURATION.base, ease: EASE }}
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
                  aria-expanded={!pastCollapsed}
                  aria-controls="past-matches"
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
                    transition={{ duration: DURATION.fast, ease: EASE_IN_OUT }}
                    className="text-muted-foreground"
                  >
                    <ChevronDown className="h-5 w-5" aria-hidden="true" />
                  </motion.div>
                </motion.button>

                <AnimatePresence>
                  {!pastCollapsed && (
                <motion.div
                  key="past-expanded"
                  id="past-matches"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_IN_OUT }}
                  style={{ transformOrigin: "top" }}
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
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: DURATION.base, ease: EASE }}
                className="fixed bottom-4 right-4 z-50"
                role="status"
                aria-live="polite"
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
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ duration: DURATION.slow, ease: EASE }}
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
          {/* LEGAL: re-open the disclaimer/terms at any time. */}
          <button
            type="button"
            onClick={openLegalNotice}
            className="mt-3 text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Terms and Disclaimer
          </button>

          {/* PWA: notification toggle — hidden when push is not supported */}
          {pushSupported && (
            <motion.button
              type="button"
              onClick={handleCycleAlerts}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Push notifications: ${alertLevel}`}
              whileTap={{ scale: 0.95 }}
            >
              {alertLevel === 'none' ? (
                <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {notificationGranted
                  ? `Alerts: ${alertLevel}`
                  : 'Enable alerts'}
              </span>
            </motion.button>
          )}

          {/* PWA: version update banner */}
          {updateAvailable && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadUpdate}
              className="mt-3 inline-flex items-center gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Update available — refresh to install
            </Button>
          )}

          {/* PWA: install prompt — rendered below footer */}
          <InstallPrompt />
        </motion.footer>
      </main>
    </div>

      {/* LEGAL: first-visit consent gate (and footer-triggered review). */}
      <LegalNotice
        open={legalOpen}
        mode={legalMode}
        onAccept={handleAcceptTerms}
        onClose={closeLegalNotice}
      />
    </>
  );
}