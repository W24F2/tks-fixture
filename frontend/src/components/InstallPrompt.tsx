/**
 * Install prompt banner.
 *
 * Detects when the browser can install the PWA and shows a dismissible
 * "Install App" banner. On install, hides the banner and shows "Installed ✓".
 *
 * Uses the beforeinstallprompt event — the only way to detect installability
 * in modern browsers. iOS Safari has no equivalent event, so we show a
 * manual "Add to Home Screen" hint for those users.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Download, X, Check, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptProps {
  className?: string;
}

export function InstallPrompt({ className }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if user dismissed the install prompt recently
  // (browser may block repeated prompts)
  const isRecentlyDismissed = useCallback(() => {
    const dismissedAt = localStorage.getItem('sf_install_dismissed_at');
    if (!dismissedAt) return false;
    const dismissed = parseInt(dismissedAt, 10);
    // Allow re-prompting after 24 hours
    return Date.now() - dismissed < 24 * 60 * 60 * 1000;
  }, []);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // iOS Safari doesn't fire beforeinstallprompt — show manual hint
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS && isSafari) {
      setShowIOSHint(true);
      return;
    }

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Only show prompt if user hasn't dismissed it recently
      if (!isRecentlyDismissed()) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setInstalled(true);
      localStorage.removeItem('sf_install_dismissed_at');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isRecentlyDismissed]);

  // Check installability periodically (in case page loads in PWA mode)
  useEffect(() => {
    if (installed || showPrompt) return;

    const checkInstallability = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;

      if (isStandalone) {
        setInstalled(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    // Check every 5 seconds
    intervalRef.current = setInterval(checkInstallability, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [installed, showPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        setInstalled(true);
      } else {
        // User dismissed — don't show again for 24 hours
        localStorage.setItem('sf_install_dismissed_at', String(Date.now()));
      }

      setShowPrompt(false);
      setDeferredPrompt(null);
    } catch {
      // Installation failed — show hint
      setShowIOSHint(true);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('sf_install_dismissed_at', String(Date.now()));
    // Keep deferredPrompt so we can retry after 24 hours
  };

  if (installed) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium", className)}
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Installed</span>
      </motion.div>
    );
  }

  if (showIOSHint) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setShowIOSHint(!showIOSHint)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50",
          "bg-background/50 hover:bg-background/80 text-sm text-muted-foreground",
          "transition-colors",
          className
        )}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Add to Home Screen</span>
        <AnimatePresence>
          {showIOSHint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground"
            >
              <p>Tap the <strong>Share</strong> button ↑ then <strong>"Add to Home Screen"</strong></p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      {showPrompt && deferredPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96",
            "rounded-xl border border-border/50 bg-background/95 backdrop-blur-lg",
            "shadow-xl p-4",
            className
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                Install Sports Fixtures
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get quick access to your fixtures. Works offline.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Button
              onClick={handleInstall}
              size="sm"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-1" aria-hidden="true" />
              Install
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-xs"
            >
              Not now
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
