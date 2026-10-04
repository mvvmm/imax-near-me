import type { TheatreDetail, Venue } from './data.ts';

// Bound response sizes and timeouts; upstream error pages must never become data.
export async function fetchText(url: string, init: RequestInit = {}, limit = 2_000_000): Promise<string> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Upstream ${new URL(url).hostname} returned HTTP ${response.status}`);
  if (!response.body) throw new Error('Empty upstream response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Upstream response exceeded size limit');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

interface Place {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  location?: { latitude?: number; longitude?: number };
}

export async function lookupTheatre(venue: Venue, key: string): Promise<TheatreDetail> {
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY secret is missing');
  async function search(query: string): Promise<Place[]> {
    const result = JSON.parse(await fetchText('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.shortFormattedAddress,places.websiteUri,places.googleMapsUri,places.location,places.nationalPhoneNumber,places.id',
      },
      body: JSON.stringify({ textQuery: `${query}` }),
    })) as { places?: Place[]; error?: unknown };
    if (result.error) throw new Error('Google Places API returned an error');
    return result.places ?? [];
  }
  let places = await search(`${venue.name}${venue.city ? ' ' + venue.city : ''}`);
  if (!places.length && venue.city) {
    for (const [english, chinese] of Object.entries({ Wanda: '万达影城', MixC: '万象城', CGV: 'CGV影城', Bona: '博纳影城' })) {
      if (venue.name.toLowerCase().includes(english.toLowerCase())) {
        places = await search(`${chinese}IMAX ${venue.city}`);
        if (places.length) break;
      }
    }
  }
  const place = places[0];
  return {
    google_places_id: place?.id ?? null, google_name: place?.displayName?.text ?? null,
    address: place?.formattedAddress ?? null, short_address: place?.shortFormattedAddress ?? null,
    website: place?.websiteUri ?? null, google_maps_url: place?.googleMapsUri ?? null,
    phone: place?.nationalPhoneNumber ?? null,
    latitude: place?.location?.latitude ?? null, longitude: place?.location?.longitude ?? null,
  };
}

export async function lookupIMAXURL(venue: Venue): Promise<{ imax_url: string | null }> {
  async function search(query: string): Promise<string[]> {
    const html = await fetchText(`https://html.duckduckgo.com/html/?${new URLSearchParams({ q: query })}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (/anomaly\.js|challenge-form|captcha/i.test(html)) throw new Error('DuckDuckGo blocked search; refusing to cache a miss');
    if (!/result|No results found/i.test(html)) throw new Error('Unrecognized DuckDuckGo search response');
    return [...html.matchAll(/uddg=([^&"\s]+)/g)].map(match => decodeURIComponent(match[1]));
  }
  const query = `${venue.name}${venue.city ? ' ' + venue.city : ''}`;
  const urls = await search(query + ' IMAX imax.com');
  const theatre = urls.find(url => /^https?:\/\/www\.imax\.com\/theatre\/.+/.test(url) && !url.includes('/finder'));
  if (theatre) return { imax_url: theatre.split(/[&?]/)[0] };
  const fallback = (await search('imax ' + venue.name))[0];
  if (fallback) {
    const url = new URL(fallback);
    if (url.hostname === 'imax.com' || url.hostname.endsWith('.imax.com')) {
      return { imax_url: fallback.split(/[&?]/)[0] };
    }
  }
  return { imax_url: null };
}
