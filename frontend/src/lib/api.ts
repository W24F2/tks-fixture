import type { Fixture, FixtureGroup, FavouriteResponse, ApiResponse } from "@/types/fixture";
import { getDeviceId } from "./device";

const API_BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}` };
    }

    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Network error" };
  }
}

function getAuthHeaders(): HeadersInit {
  const deviceId = getDeviceId();
  return {
    "Content-Type": "application/json",
    "X-Device-ID": deviceId,
  };
}

export const api = {
  async getFixtures(): Promise<ApiResponse<Fixture[]>> {
    return fetchJson<Fixture[]>(`${API_BASE}/fixtures`);
  },

  async getFavourites(): Promise<ApiResponse<FavouriteResponse[]>> {
    const deviceId = getDeviceId();
    return fetchJson<FavouriteResponse[]>(`${API_BASE}/favourites/${deviceId}`);
  },

  async addFavourite(fixtureId: number): Promise<ApiResponse<FavouriteResponse>> {
    const deviceId = getDeviceId();
    return fetchJson<FavouriteResponse>(`${API_BASE}/favourites`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ device_id: deviceId, fixture_id: fixtureId }),
    });
  },

  async removeFavourite(fixtureId: number): Promise<ApiResponse<void>> {
    const deviceId = getDeviceId();
    return fetchJson<void>(`${API_BASE}/favourites/${deviceId}/${fixtureId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
  },

  async refreshFixtures(): Promise<ApiResponse<{ message: string }>> {
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