export const SOURCE = 'https://imax.fandom.com/wiki/List_of_IMAX_venues';

export interface Venue {
  region: string;
  country: string;
  city: string;
  state?: string;
  name: string;
  screen_aspect_ratio: string;
  digital_projector: string;
  max_digital_aspect_ratio: string;
  film_projector: string;
  screen_dimensions: { raw?: string; width_m?: number; height_m?: number; diameter_m?: number };
  commercial_films: string;
  address?: string;
  website?: string;
  phone?: string;
  google_maps_url?: string;
  latitude?: number | null;
  longitude?: number | null;
  google_places_id?: string;
  imax_url?: string;
}

export interface VenueData {
  source: string;
  fetched_at: string;
  venue_count: number;
  venues: Venue[];
}

export interface TheatreDetail {
  google_places_id: string | null;
  google_name: string | null;
  address: string | null;
  short_address: string | null;
  website: string | null;
  google_maps_url: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type TheatreCache = Record<string, TheatreDetail | null>;
export type URLCache = Record<string, { imax_url: string | null } | null>;

function clean(text: string): string {
  return text.trim()
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<ref[^>]*>.*?<\/ref>/gs, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\|\}$/, '')
    .replace(/\s+/g, ' ').trim();
}

function cell(raw: string): { count: number; value: string } {
  const count = Number(raw.match(/rowspan\s*=\s*"?(\d+)"?/)?.[1] ?? 1);
  return { count, value: clean(raw.replace(/rowspan\s*=\s*"?\d+"?\s*\|/, '')) };
}

function dimensions(text: string): Venue['screen_dimensions'] {
  const raw = clean(text);
  if (!raw) return {};
  const match = raw.match(/([\d.]+)\s*m?\s*[×xX]\s*([\d.]+)\s*m/);
  if (match) return { width_m: Number(match[1]), height_m: Number(match[2]), raw };
  const diameter = raw.match(/([\d.]+)\s*m(?:\s|$)/);
  return diameter ? { diameter_m: Number(diameter[1]), raw } : { raw };
}

// Keep the shell parser's section/rowspan behavior and output field names.
export function parseWiki(wikitext: string, fetchedAt: string): VenueData {
  const sections = wikitext.split(/^(==\s*.+?\s*==)\s*$/m);
  const venues: Venue[] = [];
  for (let i = 0; i < sections.length; i++) {
    const heading = sections[i].trim().match(/^==\s*(.+?)\s*==$/);
    if (!heading || i + 1 >= sections.length) continue;
    const region = heading[1];
    const table = sections[++i].match(/\{\|.*?\|\}/s)?.[0];
    if (!table) continue;
    const hasProvince = region === 'Americas' || region === 'Asia';
    let country = { count: 0, value: '' };
    let province = { count: 0, value: '' };
    let city = { count: 0, value: '' };
    for (const row of table.split(/^\|-/m).slice(1)) {
      const cells: string[] = [];
      let current: string | undefined;
      for (const line of row.trim().split('\n')) {
        if (line.startsWith('|') && !line.startsWith('|}')) {
          if (current !== undefined) cells.push(current);
          current = line.slice(1);
        } else if (!line.startsWith('!') && current !== undefined) {
          current += '\n' + line;
        }
      }
      if (current !== undefined) cells.push(current);
      if (!cells.length) continue;
      let index = 0;
      if (country.count <= 0) {
        if (index >= cells.length) continue;
        country = cell(cells[index++]);
      }
      if (hasProvince && province.count <= 0) {
        if (index >= cells.length) { country.count--; continue; }
        province = cell(cells[index++]);
      }
      if (city.count <= 0) {
        if (index >= cells.length) {
          country.count--;
          if (hasProvince) province.count--;
          continue;
        }
        city = cell(cells[index++]);
      }
      const rest = cells.slice(index);
      if (rest.length >= 5) {
        const venue: Venue = {
          region, country: country.value, city: city.value,
          name: cell(rest[0]).value,
          screen_aspect_ratio: clean(rest[1]),
          digital_projector: clean(rest[2]),
          max_digital_aspect_ratio: clean(rest[3]),
          film_projector: clean(rest[4]),
          screen_dimensions: dimensions(rest[5] ?? ''),
          commercial_films: clean(rest[6] ?? ''),
          ...(hasProvince ? { state: province.value } : {}),
        };
        const digital = venue.digital_projector.toLowerCase();
        if (venue.name && !/^[\d.:]+$/.test(venue.name) &&
          (venue.film_projector || ['gt laser', 'laser xt', 'cola', 'dome'].some(p => digital.includes(p)))) {
          venues.push(venue);
        }
      }
      country.count--;
      city.count--;
      if (hasProvince) province.count--;
    }
  }
  if (!venues.length) throw new Error('Wiki parser produced no premium venues');
  return { source: SOURCE, fetched_at: fetchedAt, venue_count: venues.length, venues };
}

export function enrich(venue: Venue, detail: TheatreDetail | null | undefined, url: URLCache[string]): Venue {
  return {
    ...venue,
    ...(detail?.address ? {
      address: detail.address, website: detail.website ?? '', phone: detail.phone ?? '',
      google_maps_url: detail.google_maps_url ?? '', latitude: detail.latitude,
      longitude: detail.longitude, google_places_id: detail.google_places_id ?? '',
    } : {}),
    ...(url?.imax_url ? { imax_url: url.imax_url } : {}),
  };
}

export function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function assertSafeSize(key: string, bytes: number, previousBytes: number): void {
  if (bytes < Math.floor(previousBytes * 0.9)) {
    throw new Error(`Refusing to publish ${key}: ${bytes} bytes vs previous ${previousBytes} (over 10% smaller)`);
  }
}

export function assertSafeVenues(data: VenueData, previous: VenueData): void {
  if (!data.venues.length || data.venue_count !== data.venues.length) throw new Error('Invalid venue count');
  if (data.venue_count < previous.venue_count * 0.9) throw new Error('Venue count dropped by over 10%');
  const located = (v: Venue) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude);
  if (data.venues.filter(located).length < previous.venues.filter(located).length * 0.9) {
    throw new Error('Located venue count dropped by over 10%');
  }
}
