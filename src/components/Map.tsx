import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "@luomus/leaflet-smooth-wheel-zoom";
import type { Venue, Filters, FilterKey } from "../types";
import { useEffect, useMemo } from "react";
import { haversineKm, formatDistance } from "../utils";

const iconCache: Record<string, L.DivIcon> = {};

function getIconForColor(color: string) {
  if (!iconCache[color]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <defs>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.4"/>
        </filter>
      </defs>
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" filter="url(#s)"/>
      <circle cx="12" cy="11" r="4.5" fill="rgba(255,255,255,0.9)"/>
    </svg>`;
    iconCache[color] = L.divIcon({
      html: svg,
      className: "custom-marker",
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -36],
    });
  }
  return iconCache[color];
}

// Priority order (best to worst) with colors
const FILTER_PRIORITY: {
  key: FilterKey;
  color: string;
  test: (v: Venue) => boolean;
}[] = [
  {
    key: "film",
    color: "#ef4444",
    test: (v) => !!v.film_projector && !isDome(v),
  },
  {
    key: "gtLaser",
    color: "#f59e0b",
    test: (v) => v.digital_projector.includes("GT Laser"),
  },
  {
    key: "laser",
    color: "#3b82f6",
    test: (v) =>
      v.digital_projector.includes("Laser XT") ||
      v.digital_projector.toLowerCase().includes("cola"),
  },
  { key: "dome", color: "#a855f7", test: (v) => isDome(v) },
];

function isDome(venue: Venue): boolean {
  return (
    venue.digital_projector.toLowerCase().includes("dome") ||
    venue.film_projector.toLowerCase().includes("dome") ||
    venue.name.toLowerCase().includes("dome") ||
    venue.name.toLowerCase().includes("omni")
  );
}

function getIcon(venue: Venue, filters: Filters) {
  for (const { key, color, test } of FILTER_PRIORITY) {
    if (filters[key] && test(venue)) return getIconForColor(color);
  }
  return getIconForColor("#6b7280");
}

const COLOR_PRIORITY = ["#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#6b7280"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  let sizeClass = "";
  let size = 36;
  if (count >= 50) {
    sizeClass = "xlarge";
    size = 48;
  } else if (count >= 15) {
    sizeClass = "large";
    size = 42;
  }

  // Find the best (highest priority) color among child markers
  let bestIndex = COLOR_PRIORITY.length - 1;
  for (const marker of cluster.getAllChildMarkers()) {
    const html: string = marker.options.icon?.options?.html || "";
    for (let i = 0; i < bestIndex; i++) {
      if (html.includes(COLOR_PRIORITY[i])) {
        bestIndex = i;
        break;
      }
    }
    if (bestIndex === 0) break;
  }
  const color = COLOR_PRIORITY[bestIndex];

  return L.divIcon({
    html: `<div class="cluster-icon ${sizeClass}" style="background:${color}cc;box-shadow:0 2px 10px ${color}88">${count}</div>`,
    className: "marker-cluster",
    iconSize: L.point(size, size),
  });
}

function SetView({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

const isWindows =
  typeof navigator !== "undefined" && /Win/i.test(navigator.platform);

/** Reduce scroll zoom sensitivity on Windows (1/3 speed). */
function ScrollZoomAdjust() {
  const map = useMap();
  useEffect(() => {
    if (!isWindows) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (map as any).smoothWheelZoom;
    if (!handler) return;

    const original = handler._onWheeling.bind(handler);
    // eslint-disable-next-line react-hooks/immutability
    handler._onWheeling = function (e: WheelEvent) {
      const scaled = new Proxy(e, {
        get(target, prop) {
          if (prop === "deltaY") return target.deltaY / 3;
          const val = Reflect.get(target, prop);
          return typeof val === "function" ? val.bind(target) : val;
        },
      });
      return original(scaled);
    };
  }, [map]);
  return null;
}

const userLocationIcon = L.divIcon({
  html: `<div class="user-location"><div class="user-location-dot"></div><div class="user-location-pulse"></div></div>`,
  className: "custom-marker",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const isMobile =
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 768px)").matches;

function VenueMarker({
  venue,
  filters,
  userLocation,
  onSelectVenue,
}: {
  venue: Venue;
  filters: Filters;
  userLocation: { lat: number; lng: number } | null;
  onSelectVenue?: (venue: Venue | null) => void;
}) {
  const eventHandlers = useMemo(
    () => ({
      click: () => {
        onSelectVenue?.(venue);
      },
    }),
    [venue, onSelectVenue]
  );

  if (isMobile && onSelectVenue) {
    return (
      <Marker
        position={[venue.latitude, venue.longitude]}
        icon={getIcon(venue, filters)}
        eventHandlers={eventHandlers}
      />
    );
  }

  return (
    <Marker
      position={[venue.latitude, venue.longitude]}
      icon={getIcon(venue, filters)}
    >
      <Popup maxWidth={320} closeButton>
        <div className="venue-popup">
          <h3>{venue.name}</h3>
          <p className="popup-city">
            {venue.city}, {venue.country}
            {userLocation && (
              <span className="popup-distance">
                {" · "}
                {formatDistance(
                  haversineKm(
                    userLocation.lat,
                    userLocation.lng,
                    venue.latitude,
                    venue.longitude
                  )
                )}
              </span>
            )}
          </p>

          <dl className="popup-specs">
            {venue.screen_dimensions.raw && (
              <>
                <dt>Screen</dt>
                <dd>{venue.screen_dimensions.raw}</dd>
              </>
            )}
            {venue.screen_aspect_ratio && (
              <>
                <dt>Ratio</dt>
                <dd>{venue.screen_aspect_ratio}</dd>
              </>
            )}
            {venue.digital_projector && (
              <>
                <dt>Digital</dt>
                <dd>{venue.digital_projector}</dd>
              </>
            )}
            {venue.film_projector && (
              <>
                <dt>Film</dt>
                <dd>{venue.film_projector}</dd>
              </>
            )}
          </dl>

          <div className="popup-divider" />

          <div className="popup-contact">
            {venue.imax_url && (
              <a
                className="popup-link popup-showtimes"
                href={`${venue.imax_url}/movies`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2"/>
                  <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/>
                </svg>
                Showtimes
              </a>
            )}
            {venue.website && (
              <a
                className="popup-link popup-showtimes"
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                Venue
              </a>
            )}
          </div>

          {venue.address && (
            <>
              <div className="popup-divider" />
              <a
                className="popup-address"
                href={
                  venue.google_maps_url ||
                  `https://maps.google.com/?q=${encodeURIComponent(
                    venue.address
                  )}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {venue.address}
              </a>
            </>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

interface Props {
  venues: Venue[];
  filters: Filters;
  center: { lat: number; lng: number };
  zoom: number;
  userLocation: { lat: number; lng: number } | null;
  onSelectVenue?: (venue: Venue | null) => void;
}

export function Map({
  venues,
  filters,
  center,
  zoom,
  userLocation,
  onSelectVenue,
}: Props) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className="map-container"
      scrollWheelZoom={false}
      // @ts-expect-error -- leaflet-smooth-wheel-zoom plugin options
      smoothWheelZoom={true}
      smoothSensitivity={25}
      worldCopyJump={true}
      minZoom={2}
      zoomControl={false}
    >
      <SetView lat={center.lat} lng={center.lng} zoom={zoom} />
      <ScrollZoomAdjust />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        className="dark-tiles"
        maxNativeZoom={14}
      />
      <MarkerClusterGroup
        chunkedLoading
        removeOutsideVisibleBounds={false}
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={10}
        disableClusteringAtZoom={10}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        animate
      >
        {venues.map((venue, i) => (
          <VenueMarker
            key={`${venue.latitude}-${venue.longitude}-${i}`}
            venue={venue}
            filters={filters}
            userLocation={userLocation}
            onSelectVenue={onSelectVenue}
          />
        ))}
      </MarkerClusterGroup>
      {userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={userLocationIcon}
          interactive={false}
        />
      )}
    </MapContainer>
  );
}
