export interface Fixture {
  id: number;
  external_id: string;
  title: string;
  location?: string;
  event_date: string;
  event_time?: string;
  event_end_time?: string;
  sport?: string;
  opposition?: string;
  team?: string;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  is_favourite: boolean;
  last_updated: string;
}

export interface FixtureGroup {
  date: string;
  fixtures: Fixture[];
}

export interface FavouriteResponse {
  id: number;
  fixture_id: number;
  fixture: Fixture;
  created_at: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}