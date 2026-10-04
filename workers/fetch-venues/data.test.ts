import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSafeSize, assertSafeVenues, enrich, parseWiki, serialize } from './data.ts';
import type { VenueData } from './data.ts';

const wiki = `== Americas ==
{| class="wikitable"
! Country
|-
| rowspan="3" | United States
| rowspan="3" | California
| rowspan="2" | Los Angeles
| [[Theatre|Film Theatre]]<ref>citation</ref>
| 1.43:1
| GT Laser
| 1.43:1
| 15/70mm
| 30m × 22m
| Yes
|-
| Laser Theatre
| 1.90:1
| Laser XT
| 1.90:1
|
| 20m x 10m
| Yes
|-
| San Francisco
| Xenon Theatre
| 1.90:1
| 2K Xenon
| 1.90:1
|
|
| Yes
|}
== Europe ==
{|
! Country
|-
| France
| Paris
| Dome Theatre
| Dome
| Dome
|
|
| 27.00m
| No
|}`;

test('preserves rowspans, strips markup, parses dimensions, and filters base projectors', () => {
  const data = parseWiki(wiki, '2026-10-04');
  assert.equal(data.venue_count, 3);
  assert.deepEqual(data.venues.map(v => [v.name, v.country, v.city, v.state]), [
    ['Film Theatre', 'United States', 'Los Angeles', 'California'],
    ['Laser Theatre', 'United States', 'Los Angeles', 'California'],
    ['Dome Theatre', 'France', 'Paris', undefined],
  ]);
  assert.deepEqual(data.venues[0].screen_dimensions, { width_m: 30, height_m: 22, raw: '30m × 22m' });
  assert.equal(data.venues[2].screen_dimensions.diameter_m, 27);
  assert.throws(() => parseWiki('a challenge/error page', ''), /no premium venues/);
});

test('enrichment preserves cached misses and existing field names', () => {
  const venue = parseWiki(wiki, '').venues[0];
  assert.deepEqual(enrich(venue, null, { imax_url: null }), venue);
  const enriched = enrich(venue, {
    google_places_id: '123', google_name: 'Film', address: 'Address', short_address: null,
    website: null, phone: null, google_maps_url: 'https://maps.google.com', latitude: 0, longitude: 0,
  }, { imax_url: 'https://www.imax.com/theatre/film' });
  assert.equal(enriched.latitude, 0);
  assert.equal(enriched.google_places_id, '123');
  assert.equal(enriched.website, '');
  assert.equal(enriched.imax_url, 'https://www.imax.com/theatre/film');
});

test('rejects size, venue-count and coordinate loss before publication', () => {
  assert.throws(() => assertSafeSize('venues', 899, 1000), /10% smaller/);
  assert.doesNotThrow(() => assertSafeSize('venues', 900, 1000));
  const previous = parseWiki(wiki, '');
  previous.venues.forEach(v => { v.latitude = 0; v.longitude = 0; });
  assert.doesNotThrow(() => assertSafeVenues(previous, previous));
  const lost = structuredClone(previous);
  delete lost.venues[0].latitude;
  assert.throws(() => assertSafeVenues(lost, previous), /Located venue count/);
  const empty: VenueData = { ...previous, venue_count: 0, venues: [] };
  assert.throws(() => assertSafeVenues(empty, previous), /Invalid venue count/);
  const fewer = { ...previous, venue_count: 2, venues: previous.venues.slice(0, 2) };
  assert.throws(() => assertSafeVenues(fewer, previous), /Venue count dropped/);
  assert.equal(serialize({ name: '万达影城' }), '{\n  "name": "万达影城"\n}');
});
