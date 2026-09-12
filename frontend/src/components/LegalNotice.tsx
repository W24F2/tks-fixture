"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, ShieldAlert, X } from "lucide-react";
import { Button } from "./ui/Button";
import { DURATION, EASE } from "@/lib/motion";
import { LEGAL_UPDATED, LEGAL_VERSION } from "@/lib/consent";

export type LegalMode = "gate" | "review";

interface LegalNoticeProps {
  open: boolean;
  /** "gate" = first visit (must accept to continue). "review" = reopened from the footer. */
  mode?: LegalMode;
  onAccept: () => void;
  onClose: () => void;
}

interface LegalSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

/**
 * Content is data-driven so the dialog stays layout-only and the wording is
 * easy to audit/update in one place.
 */
const DISCLAIMER: LegalSection[] = [
  {
    heading: "Independent service",
    body: [
      "Sports Fixtures (\"the Service\") is an independent, unofficial information service. It is not affiliated with, endorsed by, or sponsored by any club, league, venue, broadcaster, or governing body.",
    ],
  },
  {
    heading: "Data accuracy",
    body: [
      "Fixture information is aggregated from publicly available third-party sources and may be delayed, incomplete, inaccurate, or changed without notice. Kick-off times are converted to your selected time zone and may differ from the official local time.",
      "Always confirm match details with the official source before travelling, purchasing tickets, or making any decision based on the Service.",
    ],
  },
  {
    heading: "No warranty",
    body: [
      "The Service is provided on an \"as is\" and \"as available\" basis without warranties of any kind, whether express or implied, including accuracy, fitness for a particular purpose, or uninterrupted availability.",
      "To the maximum extent permitted by law, we are not liable for any loss, damage, or inconvenience arising from your use of, or reliance on, the Service or its data.",
    ],
  },
];

const TERMS: LegalSection[] = [
  {
    heading: "1. Acceptance of terms",
    body: [
      "By accessing or using the Service you confirm that you have read, understood, and agreed to this Disclaimer and these Terms of Service. If you do not agree, you must stop using the Service.",
    ],
  },
  {
    heading: "2. Personal use licence",
    body: [
      "The Service is licensed to you for personal, non-commercial use only. You agree not to:",
    ],
    bullets: [
      "scrape, harvest, or systematically extract data from the Service;",
      "resell, redistribute, or republish the data or the Service itself;",
      "use the data to train, fine-tune, or evaluate machine-learning models;",
      "reverse engineer, interfere with, or attempt to gain unauthorised access to the Service.",
    ],
  },
  {
    heading: "3. Fair use and rate limits",
    body: [
      "Automated, repetitive, or excessive requests may be throttled or blocked without notice to protect the Service and its upstream data sources. The refresh control is intended for occasional manual use.",
    ],
  },
  {
    heading: "4. No account; local data",
    body: [
      "The Service does not require registration. Your favourites, time-zone and consent preferences are stored only in your own browser. Clearing site data or using another device or browser will remove them, and they are not recoverable by us.",
    ],
  },
  {
    heading: "5. Third-party rights",
    body: [
      "Team names, logos, trademarks, and fixture data belong to their respective owners and are used for identification and information purposes only. Nothing in these terms grants you any rights in that third-party material.",
    ],
  },
  {
    heading: "6. Availability and changes",
    body: [
      "We may modify, suspend, or discontinue any part of the Service at any time without notice. We may also update these terms; where we do, the version shown here changes and you will be asked to review and accept the new version on your next visit.",
    ],
  },
  {
    heading: "7. Acceptable use and termination",
    body: [
      "We may restrict or terminate access to anyone who breaches these terms or misuses the Service, including any attempt to overload, disrupt, or abuse it.",
    ],
  },
  {
    heading: "8. Limitation of liability",
    body: [
      "To the fullest extent permitted by applicable law, our total liability arising out of or relating to the Service is excluded. Nothing in these terms limits rights that cannot be excluded by law.",
    ],
  },
];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function LegalSectionList({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.heading} className="mt-5 first:mt-0">
          <h4 className="text-sm font-semibold text-foreground">{section.heading}</h4>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {section.bullets && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

/**
 * Accessible modal used both as a first-visit gate and as a re-openable
 * reference. Implements focus trapping, scroll locking, ESC handling (review
 * mode only) and focus restoration.
 */
export function LegalNotice({ open, mode = "gate", onAccept, onClose }: LegalNoticeProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [declined, setDeclined] = useState(false);

  const isGate = mode === "gate";

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (open) {
      setAgreed(false);
      setDeclined(false);
    }
  }, [open]);

  // Focus management + body scroll lock while open.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (the checkbox in gate mode, else the panel).
    const focusTimer = window.setTimeout(() => {
      if (isGate && checkboxRef.current) checkboxRef.current.focus();
      else panelRef.current?.focus();
    }, 0);

    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = bodyOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, isGate]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        // In gate mode the user must make an explicit choice.
        if (!isGate) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [isGate, onClose]
  );

  const handleAccept = () => {
    if (isGate && !agreed) return;
    onAccept();
  };

  return (
    // NOTE: intentionally NOT wrapped in <AnimatePresence>. An exit animation
    // here is a liability: if it fails to complete, AnimatePresence keeps the
    // overlay mounted and the whole app stays covered and unclickable. The
    // overlay therefore unmounts immediately on close (we only animate in),
    // which also suits reduced-motion users.
    <>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.base, ease: EASE }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="presentation"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-title"
            aria-describedby="legal-updated"
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl outline-none"
          >
            {/* Header */}
            <div className="flex items-start gap-3 border-b p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="legal-title" className="font-display text-lg font-semibold tracking-tight">
                  Disclaimer and Terms of Service
                </h2>
                <p id="legal-updated" className="mt-0.5 text-xs text-muted-foreground">
                  Version {LEGAL_VERSION} · Last updated {LEGAL_UPDATED}
                </p>
              </div>
              {!isGate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1 -mt-1 h-8 w-8"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>

            {/* Scrollable document body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {isGate && (
                <p className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    Before you start, please review and accept the disclaimer and terms below. This is
                    shown once and stored in your browser.
                  </span>
                </p>
              )}

              <h3 className="font-display text-base font-semibold">Disclaimer</h3>
              <LegalSectionList sections={DISCLAIMER} />

              <h3 className="mt-6 font-display text-base font-semibold">Terms of Service</h3>
              <LegalSectionList sections={TERMS} />
            </div>

            {/* Footer */}
            <div className="border-t bg-muted/30 p-5">
              {declined && isGate && (
                <p role="alert" className="mb-3 text-sm text-destructive">
                  You must accept the disclaimer and terms to use Sports Fixtures.
                </p>
              )}

              {isGate ? (
                <>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
                    <input
                      ref={checkboxRef}
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => {
                        setAgreed(e.target.checked);
                        if (e.target.checked) setDeclined(false);
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>
                      I have read and agree to the Disclaimer and Terms of Service, and I understand this
                      is an unofficial service whose data may be inaccurate.
                    </span>
                  </label>

                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={() => setDeclined(true)}>
                      Decline
                    </Button>
                    <Button onClick={handleAccept} disabled={!agreed}>
                      Accept and continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Accepting stores your choice in this browser only. Times and favourites are also
                    stored locally and are never sent to us.
                  </p>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={onClose}>
                      Close
                    </Button>
                    <Button onClick={handleAccept}>I agree</Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
