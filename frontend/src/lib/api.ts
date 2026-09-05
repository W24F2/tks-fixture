import type { Fixture, FixtureGroup, FavouriteResponse, ApiResponse } from "@/types/fixture";

const API_BASE = "/api";

const cache = new Map<string, { data: unknown; timestamp: number; etag?: string }>();
const CACHE_DURATION = 30 * 1000;

async function fetchJson<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options?.headers as Record<string, string>,
    };

    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && cached.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    const response = await fetch(url, {
      headers,
      ...options,
    });

    if (response.status === 304 && cached) {
      return { data: cached.data as T };
    }

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return { error: `Invalid JSON response: ${text.slice(0, 100)}` };
    }

    if (!response.ok) {
      return { error: (data as { error?: string })?.error || `HTTP ${response.status}` };
    }

    const etag = response.headers.get('ETag') || undefined;
    cache.set(url, { data, timestamp: Date.now(), etag });

    return { data: data as T };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Network error" };
  }
}

export function clearCache(): void {
  cache.clear();
}

export function getCachedData<T>(url: string): T | null {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
}

function getAuthHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}

export const api = {
  async getFixtures(): Promise<ApiResponse<Fixture[]>> {
    return fetchJson<Fixture[]>(`${API_BASE}/fixtures`);
  },

  async refreshFixtures(): Promise<ApiResponse<{ message: string }>> {
    clearCache();
    return fetchJson<{ message: string }>(`${API_BASE}/fixtures/refresh`, {
      method: "POST",
    });
  },

  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return fetchJson<{ status: string }>(`${API_BASE}/health`);
  },
};

export function groupFixturesByDate(fixtures: Fixture[]): FixtureGroup[] {
  const groups = new Map<string, Fixture[]>();

  for (const fixture of fixtures) {
    const date = fixture.event_date.split("T")[0];
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(fixture);
  }

  return Array.from(groups.entries())
    .map(([date, fixtures]) => ({
      date,
      fixtures: fixtures.sort((a, b) => {
        const timeA = a.event_time || "00:00";
        const timeB = b.event_time || "00:00";
        return timeA.localeCompare(timeB);
      }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupFixturesWithFavouritesFirst(fixtures: Fixture[]): FixtureGroup[] {
  const favourites = fixtures.filter(f => f.is_favourite);
  const nonFavourites = fixtures.filter(f => !f.is_favourite);
  
  const groups: FixtureGroup[] = [];
  
  if (favourites.length > 0) {
    // Sort favourites by date/time
    favourites.sort((a, b) => {
      const dateA = new Date(a.event_date + "T" + (a.event_time || "00:00")).getTime();
      const dateB = new Date(b.event_date + "T" + (b.event_time || "00:00")).getTime();
      return dateA - dateB;
    });
    
    groups.push({
      date: "favourites",
      fixtures: favourites,
    });
  }
  
  // Group non-favourites by date
  const nonFavGroups = groupFixturesByDate(nonFavourites);
  groups.push(...nonFavGroups);
  
  return groups;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(timeStr?: string): string {
  if (!timeStr) return "TBA";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function getStatusColor(status: Fixture["status"]): string {
  switch (status) {
    case "live":
      return "text-green-500";
    case "completed":
      return "text-muted-foreground";
    case "cancelled":
      return "text-red-500";
    default:
      return "text-primary";
  }
}

export function getStatusBadge(status: Fixture["status"]): { label: string; className: string } {
  switch (status) {
    case "live":
      return { label: "LIVE", className: "bg-green-500/10 text-green-500 border-green-500/20" };
    case "completed":
      return { label: "FINISHED", className: "bg-muted text-muted-foreground border-transparent" };
    case "cancelled":
      return { label: "CANCELLED", className: "bg-red-500/10 text-red-500 border-red-500/20" };
    default:
      return { label: "UPCOMING", className: "bg-primary/10 text-primary border-primary/20" };
  }
}