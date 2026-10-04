# IMAX Near Me

Interactive map of IMAX theatres worldwide. Filter by projector type — 15/70mm film, GT Laser, single laser, and dome — to find the best IMAX experience near you.

Live at [imaxnearme.com](https://imaxnearme.com).

## Architecture

React SPA deployed on Cloudflare Workers. Venue data is fetched at runtime from Cloudflare R2 (`data.imaxnearme.com/imax-venues.json`). One Worker, `70mm`, serves static assets and runs a twice-monthly Cloudflare cron. The `worker/` directory contains its durable `FetchVenues` Workflow, which refreshes the R2 data. The project uses the cf CLI and Cloudflare Vite plugin. Workers Builds deploys production when the owner merges a PR to `main`; do not manually deploy without asking the owner.

## Project Structure

```
src/
├── main.tsx                 # React DOM entry point
├── App.tsx                  # Root component, filtering logic, state management
├── App.css                  # Global styles (dark theme, responsive layout)
├── types.ts                 # TypeScript interfaces (Venue, Filters, etc.)
├── utils.ts                 # Haversine distance, locale-aware formatting
├── components/
│   ├── Map.tsx              # Leaflet map with clustered, color-coded markers
│   ├── Filters.tsx          # Projector type toggle filters
│   ├── InfoPanel.tsx        # Educational info about IMAX projector types
│   └── VenueDrawer.tsx      # Mobile venue detail drawer
└── hooks/
    └── useGeolocation.ts    # Browser geolocation with permission handling
worker/
├── index.ts                # Website asset handler, cron, and refresh Workflow
├── data.ts                 # Wiki parsing, enrichment, publication guards
└── lookups.ts              # Google Places and IMAX URL lookups
scripts/
├── fetch-imax-venues.sh     # Data pipeline: wiki → Google Places → IMAX URLs
├── lookup-theatre.sh        # Google Places API lookup + caching
├── lookup-imax-url.sh       # DuckDuckGo search for imax.com theatre URLs
└── safe-r2-upload.sh        # R2 upload with size-drop safety check
```

## Data Pipeline

Venue data is sourced from the [IMAX Fandom Wiki](https://imax.fandom.com/wiki/List_of_IMAX_venues), enriched with Google Places API details (coordinates, address, phone, website), and matched to imax.com theatre pages for showtimes links. Results are cached in `theatre-details.json` and `imax-urls.json` to avoid redundant API calls. The pipeline runs via `npm run fetch-venues` and outputs `imax-venues.json`.

Only premium IMAX projectors are included: 15/70mm film, GT Laser, Laser XT/CoLa, and dome venues. Base-level single 2K xenon/laser screens are filtered out.

## Key Conventions

- **Projector categories**: GT Laser, Laser (XT/CoLa), 15/70mm Film, Dome — each has a distinct marker color (orange, blue, red, purple)
- **Filtering**: Venues match if they satisfy ANY active filter (OR logic). No active filters = nothing shown.
- **Overlapping venues**: Pins at the same coordinates are offset in a circle pattern to remain selectable
- **Geolocation**: Defaults to US center (39.8°N, 98.6°W) at zoom 4; zooms to 8 when user location is found
- **Styles**: Dark theme, glassmorphism panels with backdrop blur, Inter font

## Stack

React 19, TypeScript, Vite, Leaflet, React-Leaflet, Cloudflare Workers/R2

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | TypeScript check + production build |
| `npm run deploy` | Build and deploy to Cloudflare with cf |
| `npm run deploy:preview` | Deploy a PR/branch preview and report URLs to Builds |
| `npm run check:fetch-venues` | Generate bindings types and check Worker code |
| `npm run refresh-venues` | Start a manual Cloudflare refresh |
| `npm run fetch-venues` | Run full data pipeline |
| `npm run upload-venues` | Upload venue data to R2 |
| `npm run upload-cache` | Upload Google Places cache to R2 |
| `npm run download-cache` | Download Google Places cache from R2 |
