/**
 * Offline indicator banner.
 *
 * Shows a fixed banner at the top of the viewport when:
 * - The user has no internet connection (navigator.onLine === false)
 * - The service worker fails to fetch data (cached view mode)
 *
 * The banner auto-hides when the connection is restored.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, ArrowDownCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  /** Whether the main content is showing cached (stale) data. */
  usingCache?: boolean;
  /** Callback to force a fresh data fetch. */
  onRefresh?: () => void;
  /** Whether the user has actively dismissed the banner. */
  dismissed?: boolean;
  onDismiss: () => void;
}

export function OfflineIndicator({ usingCache = false, onRefresh, dismissed = false, onDismiss }: OfflineIndicatorProps) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const wasOfflineRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateBannerState = useCallback(() => {
    const offline = !navigator.onLine;

    if (offline) {
      // Going offline — show banner
      setShowBanner(true);
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current) {
      // Coming back online — show briefly then hide
      setShowBanner(true);
      wasOfflineRef.current = false;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setShowBanner(false);
      }, 3000);
    }
  }, []);

  useEffect(() => {
    // Listen for online/offline events
    window.addEventListener('online', updateBannerState);
    window.addEventListener('offline', updateBannerState);

    return () => {
      window.removeEventListener('online', updateBannerState);
      window.removeEventListener('offline', updateBannerState);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [updateBannerState]);

  // Show banner when using cache
  useEffect(() => {
    if (usingCache) setShowBanner(true);
  }, [usingCache]);

  // Hide when user dismisses
  useEffect(() => {
    if (dismissed) setShowBanner(false);
  }, [dismissed]);

  const handleDismiss = () => {
    setShowBanner(false);
    onDismiss();
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed top-0 left-0 right-0 z-[100]",
            "pointer-events-none"
          )}
        >
          <div className={cn(
            "mx-auto mt-0 max-w-2xl pointer-events-auto",
            "rounded-b-lg px-3 py-2",
            "border-x border-b border-border/30",
            isOffline
              ? "bg-red-500/90 text-red-50 shadow-lg backdrop-blur-md"
              : "bg-amber-500/90 text-amber-50 shadow-lg backdrop-blur-md"
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isOffline ? (
                  <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : usingCache ? (
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <p className="text-xs font-medium">
                  {isOffline
                    ? "You're offline"
                    : usingCache
                      ? "Showing cached fixtures"
                      : "Connection restored"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onRefresh && !isOffline && (
                  <button
                    onClick={onRefresh}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white/20 hover:bg-white/30 transition-colors"
                    aria-label="Refresh fixtures"
                  >
                    <ArrowDownCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
                <button
                  onClick={handleDismiss}
                  className="p-0.5 rounded hover:bg-white/20 transition-colors"
                  aria-label="Dismiss"
                >
                  <span className="text-sm leading-none">×</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
