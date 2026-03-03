import { useState, useEffect, useMemo } from "react";
import { Map } from "./components/Map";
import { Filters } from "./components/Filters";
import { InfoPanel } from "./components/InfoPanel";
import { VenueDrawer } from "./components/VenueDrawer";
import { useGeolocation } from "./hooks/useGeolocation";
import type {
  Venue,
  VenueData,
  Filters as FiltersType,
  FilterKey,
} from "./types";
import "leaflet/dist/leaflet.css";
import "./App.css";

function isDome(venue: Venue): boolean {
  return (
    venue.digital_projector.toLowerCase().includes("dome") ||
    venue.film_projector.toLowerCase().includes("dome") ||
    venue.name.toLowerCase().includes("dome") ||
    venue.name.toLowerCase().includes("omni")
  );
}

function matchesFilters(venue: Venue, filters: FiltersType): boolean {
  const dp = venue.digital_projector;
  const isGT = dp.includes("GT Laser");
  const isLaser =
    !isGT && (dp.includes("Laser XT") || dp.toLowerCase().includes("cola"));
  const isFilm = !!venue.film_projector;
  const isVenueDome = isDome(venue);
  // A venue is shown if it matches ANY active filter
  const checks: boolean[] = [];
  if (filters.gtLaser) checks.push(isGT);
  if (filters.laser) checks.push(isLaser);
  if (filters.film) checks.push(isFilm && !isVenueDome);
  if (filters.dome) checks.push(isVenueDome);

  // If no filters active, show nothing
  if (checks.length === 0) return false;

  return checks.some(Boolean);
}

function offsetOverlapping(venues: Venue[]): Venue[] {
  const seen: Record<string, number> = {};
  const OFFSET = 0.002; // ~200m, enough to clearly separate pins

  return venues.map((v) => {
    const key = `${v.latitude},${v.longitude}`;
    const count = seen[key] ?? 0;
    seen[key] = count + 1;
    if (count === 0) return v;

    const angle = (count * 2 * Math.PI) / 3; // spread in a circle
    return {
      ...v,
      latitude: v.latitude + OFFSET * Math.cos(angle),
      longitude: v.longitude + OFFSET * Math.sin(angle),
    };
  });
}

function getInitialTheme(): "light" | "dark" {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filters, setFilters] = useState<FiltersType>({
    gtLaser: true,
    laser: true,
    film: true,
    dome: true,
  });
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const geo = useGeolocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    fetch("https://data.imaxnearme.com/imax-venues.json")
      .then((r) => r.json())
      .then((data: VenueData) => setVenues(offsetOverlapping(data.venues)));
  }, []);

  const filtered = useMemo(
    () => venues.filter((v) => matchesFilters(v, filters)),
    [venues, filters]
  );

  const toggle = (key: FilterKey) => {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  };

  return (
    <>
      <div className="panels-wrapper">
        <Filters
          filters={filters}
          onToggle={toggle}
          venueCount={filtered.length}
          totalCount={venues.length}
          showInfo={showInfo}
          onToggleInfo={() => setShowInfo((s) => !s)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <InfoPanel visible={showInfo} onClose={() => setShowInfo(false)} />
      </div>
      <Map
        venues={filtered}
        filters={filters}
        center={{ lat: geo.lat, lng: geo.lng }}
        zoom={geo.defaultZoom}
        userLocation={geo.located ? { lat: geo.lat, lng: geo.lng } : null}
        onSelectVenue={setSelectedVenue}
        theme={theme}
      />
      <VenueDrawer
        venue={selectedVenue}
        userLocation={geo.located ? { lat: geo.lat, lng: geo.lng } : null}
        onClose={() => setSelectedVenue(null)}
      />
      <a
        href="https://github.com/mvvmm/imax-near-me"
        target="_blank"
        rel="noopener noreferrer"
        className="source-link"
      >
        Source
      </a>
    </>
  );
}
