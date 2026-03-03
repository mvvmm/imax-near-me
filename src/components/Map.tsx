import MapGL, {
  Marker,
  Popup,
  AttributionControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Venue, Filters, FilterKey } from "../types";
import { useRef, useState, useEffect, useCallback } from "react";
import { haversineKm, formatDistance } from "../utils";

const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const LIGHT_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

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

function getColor(venue: Venue, filters: Filters): string {
  for (const { key, color, test } of FILTER_PRIORITY) {
    if (filters[key] && test(venue)) return color;
  }
  return "#6b7280";
}

const isMobile =
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 768px)").matches;

function PinIcon({ color }: { color: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 36"
      width="24"
      height="36"
      style={{ display: "block", cursor: "pointer" }}
    >
      <defs>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1.5"
            floodColor="#000"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      <path
        d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
        fill={color}
        filter="url(#s)"
      />
      <circle cx="12" cy="11" r="4.5" fill="rgba(255,255,255,0.9)" />
    </svg>
  );
}

function VenuePopup({
  venue,
  userLocation,
  onClose,
}: {
  venue: Venue;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  return (
    <Popup
      longitude={venue.longitude}
      latitude={venue.latitude}
      anchor="bottom"
      offset={[0, -36] as [number, number]}
      closeOnClick={false}
      onClose={onClose}
      maxWidth="320px"
    >
      <div className="venue-popup">
        <h3>{venue.name}</h3>
        <p className="popup-city">
          {venue.city}, {venue.country}
          {userLocation && (
            <span className="popup-distance">
              {" \u00b7 "}
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" />
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
  );
}

interface Props {
  venues: Venue[];
  filters: Filters;
  center: { lat: number; lng: number };
  zoom: number;
  userLocation: { lat: number; lng: number } | null;
  onSelectVenue?: (venue: Venue | null) => void;
  theme?: "light" | "dark";
}

export function Map({
  venues,
  filters,
  center,
  zoom,
  userLocation,
  onSelectVenue,
  theme = "dark",
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [popupVenue, setPopupVenue] = useState<Venue | null>(null);

  // Fly to user location when geolocation resolves (and map is ready)
  const hasCentered = useRef(false);
  const mapLoaded = useRef(false);

  const flyToUser = useCallback(() => {
    if (hasCentered.current || !mapLoaded.current || !userLocation) return;
    const map = mapRef.current;
    if (!map) return;
    hasCentered.current = true;
    map.flyTo({
      center: [center.lng, center.lat],
      zoom,
      duration: 1500,
    });
  }, [center, zoom, userLocation]);

  useEffect(() => {
    flyToUser();
  }, [flyToUser]);

  const onLoad = useCallback(() => {
    mapLoaded.current = true;
    flyToUser();
  }, [flyToUser]);

  const handleMarkerClick = useCallback(
    (venue: Venue) => {
      mapRef.current?.flyTo({
        center: [venue.longitude, venue.latitude],
        duration: 500,
      });
      if (isMobile && onSelectVenue) {
        onSelectVenue(venue);
      } else {
        setPopupVenue(venue);
      }
    },
    [onSelectVenue]
  );

  return (
    <MapGL
      ref={mapRef}
      initialViewState={{
        longitude: center.lng,
        latitude: center.lat,
        zoom,
      }}
      style={{ width: "100vw", height: "100vh" }}
      mapStyle={theme === "dark" ? DARK_STYLE : LIGHT_STYLE}
      attributionControl={false}
      dragRotate={false}
      keyboard={true}
      touchPitch={true}
      touchZoomRotate={true}
      minZoom={2}
      onLoad={onLoad}
    >
      <AttributionControl position="bottom-right" compact={false} />

      {venues.map((venue, i) => (
        <Marker
          key={`venue-${i}`}
          longitude={venue.longitude}
          latitude={venue.latitude}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            handleMarkerClick(venue);
          }}
        >
          <PinIcon color={getColor(venue, filters)} />
        </Marker>
      ))}

      {popupVenue && (
        <VenuePopup
          venue={popupVenue}
          userLocation={userLocation}
          onClose={() => setPopupVenue(null)}
        />
      )}

      {userLocation && (
        <Marker
          longitude={userLocation.lng}
          latitude={userLocation.lat}
          anchor="center"
        >
          <div className="user-location">
            <div className="user-location-dot" />
            <div className="user-location-pulse" />
          </div>
        </Marker>
      )}
    </MapGL>
  );
}
