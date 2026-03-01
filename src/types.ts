export interface ScreenDimensions {
  width_m: number;
  height_m: number;
  raw: string;
}

export interface Venue {
  region: string;
  country: string;
  city: string;
  name: string;
  screen_aspect_ratio: string;
  digital_projector: string;
  max_digital_aspect_ratio: string;
  film_projector: string;
  screen_dimensions: ScreenDimensions;
  commercial_films: string;
  address: string;
  website: string;
  phone: string;
  google_maps_url: string;
  latitude: number;
  longitude: number;
  google_places_id: string;
  imax_url?: string;
}

export interface VenueData {
  source: string;
  fetched_at: string;
  venue_count: number;
  venues: Venue[];
}

export type FilterKey = "gtLaser" | "laser" | "film" | "dome";

export interface Filters {
  gtLaser: boolean;
  laser: boolean;
  film: boolean;
  dome: boolean;
}
