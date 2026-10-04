# [IMAX near me](https://imaxnearme.com)

![IMAX Near Me](public/IMAX-near-me-preview.png)

Interactive map of premium IMAX theatres worldwide, filtered by projector type.
Venue data comes from the [IMAX Fandom Wiki](https://imax.fandom.com/wiki/List_of_IMAX_venues),
enriched with Google Places details and IMAX.com showtimes links, and is served
from Cloudflare R2. Base-level xenon screens are excluded.

## Development

Requires Node.js 24 or later.

```sh
npm ci
npm ci --prefix workers/fetch-venues
npx cf auth login
npm run dev
```

Both projects use `cloudflare.config.ts`, `cf`, and the Cloudflare Vite plugin.
The website is an assets-only Worker named `70mm` on `imaxnearme.com`.

The shell data pipeline remains available for local use. Put
`GOOGLE_PLACES_API_KEY` in `.env`, then run `npm run fetch-venues`. For local
venue data, copy `imax-venues.json` into `public/`.

An API token in `.env` takes precedence over the saved cf login. To use the
saved login when an older repository token has insufficient permissions, run
commands with `CLOUDFLARE_API_TOKEN=`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Develop the website with cf/Vite |
| `npm run build` | Type-check and build Cloudflare Build Output |
| `npm run deploy` | Build and deploy the website with cf |
| `npm run deploy:preview` | Deploy a branch preview and report its URLs to Builds |
| `npm test` | Test parsing, enrichment, upload guards, and preview reporting |
| `npm run build:fetch-venues` | Generate types, check, and build the refresh Worker |
| `npm run deploy:fetch-venues` | Deploy the refresh Worker |
| `npm run refresh-venues` | Start a manual Cloudflare venue refresh |
| `npm run fetch-venues` | Run the original local shell pipeline |
| `npm run download-cache` | Download the Google Places cache through cf |
| `npm run download-imax-cache` | Download the IMAX URL cache through cf |
| `npm run upload-venues` | Upload venue data after the size-drop check |
| `npm run upload-cache` | Upload the Google Places cache after the size-drop check |
| `npm run upload-imax-cache` | Upload the IMAX URL cache after the size-drop check |

## Workers Builds and PR previews

Both Workers connect to `mvvmm/imax-near-me` through Workers Builds, using Node 24.

| Worker | Build root | Build command | Deploy command |
| --- | --- | --- | --- |
| Website production (`main`) | `/` | `npm test && npm run build` | `npx cf deploy --prebuilt --mode production` |
| Website previews (feature branches/PRs) | `/` | `npm test` | `npm run deploy:preview` |
| Venue refresh production (`main`) | `workers/fetch-venues` | `npm test && npm run build` | `npx cf deploy --prebuilt --mode production` |

The refresh Worker watches `workers/fetch-venues/**`. Its Builds previews are
disabled: website previews display the public R2 dataset, and feature branches
must not schedule production data refreshes. The website production domain route
is omitted in preview builds.

`cf previews deploy` currently omits the output file Workers Builds needs for
PR comments ([cf issue #185](https://github.com/cloudflare/cf/issues/185)).
`scripts/deploy-preview.mjs` runs cf and writes its result with `worker_name` and
`timestamp` into `WRANGLER_OUTPUT_FILE_DIRECTORY`. The environment variable and
file prefix are Cloudflare's existing reporting protocol; no Wrangler package
or executable is used. Remove this wrapper after the upstream fix is verified.

## Scheduled venue refresh

`workers/fetch-venues/` deploys the separate `imaxnearme-fetch-venues` Worker.
Its cron runs at **06:00 UTC on the 1st and 15th of each month**
(`0 6 1,15 * *`) and starts a durable Workflow. Scheduling is independent of
GitHub repository activity; the old GitHub scheduled workflow has been retired.

The refresh reads `theatre-details.json` and `imax-urls.json` from the existing
`imaxnearme-data` bucket and looks up only uncached venues. Durable batches retry
upstream failures. HTTP failures and search challenges never become permanent
cached misses. All three JSON files must pass the existing 10% size-drop guard;
venue and coordinate counts must also stay within 10% of the previous dataset.
The public dataset is published last. Errors remain visible in Cloudflare
Workflow status and Worker logs while the previous dataset stays available.

The Worker requires the Cloudflare secret `GOOGLE_PLACES_API_KEY`. For its first
deployment, use a private JSON secrets file containing that key:

```sh
cd workers/fetch-venues
npx cf deploy --secrets-file /path/to/secrets.json
```

Subsequent deploys retain the installed secret. Never commit the secrets file.
The running job uses a direct R2 binding and needs no Cloudflare API token.
Inspect runs in the Cloudflare Workflows dashboard or with
`cf workflows instances get imaxnearme-fetch-venues INSTANCE_ID`.

## Stack

React, MapLibre, TypeScript, Vite, Cloudflare Workers/R2/Workflows, cf CLI.
