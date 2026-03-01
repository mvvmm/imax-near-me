# [imaxnearme.com](https://imaxnearme.com)

![IMAX Near Me](public/preview-image.png)

Interactive map of IMAX theatres worldwide. Filter by projector type — 15/70mm film, GT Laser, single laser, and dome — to find the best IMAX experience near you.

## Data

Venue data is sourced from the [IMAX Fandom Wiki](https://imax.fandom.com/wiki/List_of_IMAX_venues) and enriched with location data from the Google Places API. Data is refreshed biweekly and served from Cloudflare R2.

Only venues with premium projectors are included — base-level IMAX (single 2K xenon/laser) screens are filtered out, since they offer little advantage over a standard cinema screen.

## Development

```
npm install
npm run dev
```

For local development with venue data, fetch and place it in `public/`:

```
npm run fetch-venues
cp imax-venues.json public/imax-venues.json
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | TypeScript check + production build |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run fetch-venues` | Fetch venue data from wiki + Google Places |
| `npm run upload-venues` | Upload venue data to R2 |
| `npm run upload-cache` | Upload Google Places cache to R2 |
| `npm run download-cache` | Download Google Places cache from R2 |

## Stack

React, Leaflet, Vite, Cloudflare Workers/R2
