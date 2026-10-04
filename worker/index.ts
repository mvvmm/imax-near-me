import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { assertSafeSize, assertSafeVenues, enrich, parseWiki, serialize } from './data.ts';
import type { TheatreCache, URLCache, VenueData } from './data.ts';
import { fetchText, lookupIMAXURL, lookupTheatre } from './lookups.ts';

// Bindings and runtime types are generated from cloudflare.config.ts.
type Env = Cloudflare.Env;
const retry = { retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' as const }, timeout: '10 minutes' } as const;

export class FetchVenues extends WorkflowEntrypoint<Env> {
  async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
    const data = await step.do('fetch and parse wiki', retry, async () => {
      const payload = JSON.parse(await fetchText(
        'https://imax.fandom.com/api.php?action=parse&page=List_of_IMAX_venues&prop=wikitext&format=json', {}, 8_000_000,
      )) as { parse?: { wikitext?: { '*': string } } };
      const wiki = payload.parse?.wikitext?.['*'];
      if (!wiki) throw new Error('Wiki API returned no wikitext');
      return parseWiki(wiki, new Date().toISOString());
    });

    const caches = await step.do('load R2 caches', retry, async () => {
      const [theatres, urls, previous] = await Promise.all([
        this.env.DATA.get('theatre-details.json'), this.env.DATA.get('imax-urls.json'), this.env.DATA.get('imax-venues.json'),
      ]);
      // A missing cache should not silently cause hundreds of paid API calls.
      if (!theatres || !urls || !previous) throw new Error('Required R2 data/cache object is missing');
      const previousData = await previous.json<VenueData>();
      if (data.venue_count < previousData.venue_count * 0.9) throw new Error('Parsed venue count dropped by over 10%');
      return { theatres: await theatres.json<TheatreCache>(), urls: await urls.json<URLCache>() };
    });

    const missing = data.venues.filter(v => !Object.hasOwn(caches.theatres, v.name) || !Object.hasOwn(caches.urls, v.name));
    // Small durable batches bound subrequests and preserve completed lookups on retry.
    for (let offset = 0; offset < missing.length; offset += 10) {
      const batch = missing.slice(offset, offset + 10);
      const additions = await step.do(`enrich venues ${offset}-${offset + batch.length}`, retry, async () => {
        const theatres: TheatreCache = {};
        const urls: URLCache = {};
        for (const venue of batch) {
          if (!Object.hasOwn(caches.theatres, venue.name)) theatres[venue.name] = await lookupTheatre(venue, this.env.GOOGLE_PLACES_API_KEY);
          if (!Object.hasOwn(caches.urls, venue.name)) urls[venue.name] = await lookupIMAXURL(venue);
        }
        return { theatres, urls };
      });
      Object.assign(caches.theatres, additions.theatres);
      Object.assign(caches.urls, additions.urls);
      if (offset + 10 < missing.length) await step.sleep(`pause after ${offset}`, '2 seconds');
    }

    data.venues = data.venues.map(v => enrich(v, caches.theatres[v.name], caches.urls[v.name]));
    return await step.do('validate and publish to R2', retry, async () => {
      const previous = await this.env.DATA.get('imax-venues.json');
      if (!previous) throw new Error('Previous venue dataset is missing');
      const oldData = await previous.json<VenueData>();
      // A manual run must not overwrite a newer scheduled run.
      if (oldData.fetched_at > data.fetched_at) throw new Error('A newer refresh has already published');
      assertSafeVenues(data, oldData);
      const objects = [
        { key: 'theatre-details.json', value: caches.theatres },
        { key: 'imax-urls.json', value: caches.urls },
        { key: 'imax-venues.json', value: data },
      ];
      const uploads = await Promise.all(objects.map(async ({ key, value }) => {
        const existing = await this.env.DATA.head(key);
        if (!existing) throw new Error(`Previous ${key} is missing`);
        const body = serialize(value);
        assertSafeSize(key, new TextEncoder().encode(body).byteLength, existing.size);
        return { key, body, etag: key === 'imax-venues.json' ? previous.etag : existing.etag };
      }));
      // Preflight every object before writing; publish the public dataset last.
      for (const { key, body, etag } of uploads) {
        const result = await this.env.DATA.put(key, body, {
          onlyIf: { etagMatches: etag },
          httpMetadata: { contentType: 'application/json' },
        });
        if (!result) throw new Error(`${key} changed during publication; retrying`);
      }
      console.log(JSON.stringify({ event: 'venues-refreshed', venue_count: data.venue_count, new_venues: missing.length, fetched_at: data.fetched_at }));
      return { venue_count: data.venue_count, new_venues: missing.length, fetched_at: data.fetched_at };
    });
  }
}

export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env) {
    const instance = await env.FETCH_VENUES.create({ id: `scheduled-${controller.scheduledTime}` });
    console.log(JSON.stringify({ event: 'refresh-started', instance_id: instance.id }));
  },
} satisfies ExportedHandler<Env>;
