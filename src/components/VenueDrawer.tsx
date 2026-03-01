import type { Venue } from "../types";
import { haversineKm, formatDistance } from "../utils";

interface Props {
  venue: Venue | null;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}

export function VenueDrawer({ venue, userLocation, onClose }: Props) {
  if (!venue) return null;

  return (
    <div className="venue-drawer">
      <button
        className="venue-drawer-close"
        onClick={onClose}
        aria-label="Close"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>
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
    </div>
  );
}
