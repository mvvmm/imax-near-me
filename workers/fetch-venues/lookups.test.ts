import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchText, lookupIMAXURL, lookupTheatre } from './lookups.ts';
import type { Venue } from './data.ts';

const venue: Venue = {
  region: 'Asia', country: 'China', city: 'Beijing', name: 'Wanda IMAX',
  screen_aspect_ratio: '', digital_projector: 'GT Laser', max_digital_aspect_ratio: '',
  film_projector: '', screen_dimensions: {}, commercial_films: '',
};

test('Google lookup retries known Chinese chains and maps Places fields', async t => {
  const queries: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('X-Goog-Api-Key'), 'test-key');
    queries.push(JSON.parse(String(init.body)).textQuery);
    return Response.json(queries.length === 1 ? {} : { places: [{ id: 'abc', formattedAddress: 'Beijing', location: { latitude: 0, longitude: 1 } }] });
  });
  const result = await lookupTheatre(venue, 'test-key');
  assert.deepEqual(queries, ['Wanda IMAX Beijing', '万达影城IMAX Beijing']);
  assert.equal(result.google_places_id, 'abc');
  assert.equal(result.latitude, 0);
});

test('HTTP failures and oversized responses fail instead of poisoning caches', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('quota exceeded', { status: 429 }));
  await assert.rejects(lookupTheatre(venue, 'test-key'), /HTTP 429/);
  t.mock.method(globalThis, 'fetch', async () => new Response('123456'));
  await assert.rejects(fetchText('https://example.com', {}, 5), /size limit/);
});

test('IMAX search decodes theatre links and strips tracking parameters', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<div class="result"><a href="?uddg=https%3A%2F%2Fwww.imax.com%2Ftheatre%2Ftest%3Fx%3D1&rut=abc">test</a></div>'));
  assert.deepEqual(await lookupIMAXURL(venue), { imax_url: 'https://www.imax.com/theatre/test' });
});

test('search challenges fail rather than caching a permanent miss', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<form id="challenge-form">captcha</form>'));
  await assert.rejects(lookupIMAXURL(venue), /blocked search/);
});

test('fallback accepts only the actual imax.com domain', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<div class="result"><a href="?uddg=https%3A%2F%2Ffakeimax.com%2Ftheatre&rut=abc">test</a></div>'));
  assert.deepEqual(await lookupIMAXURL(venue), { imax_url: null });
});
