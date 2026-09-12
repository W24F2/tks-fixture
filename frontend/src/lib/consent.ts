/**
 * First-visit legal consent.
 *
 * The app has no accounts, so "accepted the terms" is tracked locally in the
 * browser (same approach as favourites) instead of on a server. Acceptance is
 * versioned: whenever LEGAL_VERSION changes, users are asked to review and
 * accept again on their next visit.
 */

const CONSENT_KEY = "sf_legal_consent";

/** Bump this when the disclaimer/terms materially change. */
export const LEGAL_VERSION = "1.0.0";

/** Human-readable date shown in the dialog ("last updated"). */
export const LEGAL_UPDATED = "12 September 2026";

export interface ConsentRecord {
  version: string;
  acceptedAt: string;
}

export function getConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (!parsed || typeof parsed.version !== "string") return null;
    return {
      version: parsed.version,
      acceptedAt: typeof parsed.acceptedAt === "string" ? parsed.acceptedAt : "",
    };
  } catch {
    // Corrupt/unavailable storage (private mode, quota, disabled) — treat as
    // not accepted so the user still sees the notice.
    return null;
  }
}

/** True only when the *current* version has been accepted. */
export function hasAcceptedCurrentTerms(): boolean {
  return getConsent()?.version === LEGAL_VERSION;
}

/** Persist acceptance of the current version. Returns the stored record. */
export function acceptTerms(): ConsentRecord {
  const record: ConsentRecord = {
    version: LEGAL_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    } catch {
      // Storage unavailable — accept for this session only (in-memory state
      // in App keeps the gate closed until reload).
    }
  }
  return record;
}

/** Clear stored consent (e.g. a user withdrawing acceptance). */
export function revokeTerms(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // ignore
  }
}
