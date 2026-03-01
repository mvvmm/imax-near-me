const PROJECTOR_TYPES = [
  {
    name: "15/70mm Film",
    color: "#ef4444",
    description:
      "Original IMAX format. 70mm film stock running horizontally through a projector at 24fps. Largest frame size of any motion picture format. Unmatched resolution and dynamic range. Being phased out but still the gold standard.",
  },
  {
    name: "GT Laser",
    color: "#f59e0b",
    description:
      "Dual 4K laser projectors, the best digital IMAX system. Capable of 1.43:1 aspect ratio on the tallest screens. Closest digital equivalent to 15/70mm film.",
  },
  {
    name: "Laser",
    color: "#3b82f6",
    description:
      "Single laser projector (Laser XT or CoLa). Sharper and brighter than older xenon digital, but limited to 1.90:1 aspect ratio. Most common modern IMAX install.",
  },
  {
    name: "Dome",
    color: "#a855f7",
    description:
      "Hemispherical screens for immersive planetarium-style viewing. Originally OMNIMAX with 15/70mm film, many now retrofitted with laser. Found in science centers and museums.",
  },
];

const LINKS = [
  {
    label: "IMAX Wiki Venues List",
    url: "https://imax.fandom.com/wiki/List_of_IMAX_venues",
  },
  { label: "IMAX Official", url: "https://www.imax.com" },
  { label: "in70mm.com", url: "https://www.in70mm.com/" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function InfoPanel({ visible, onClose }: Props) {
  if (!visible) return null;

  return (
    <div className="info-panel">
      <div className="info-header">
        <h3>About IMAX Projectors</h3>
        <button
          className="info-close"
          onClick={onClose}
          aria-label="Close info panel"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="info-section">
        <h4>Projector Types</h4>
        <p className="info-note">
          Ordered by quality and relevance for commercial films
        </p>
        {PROJECTOR_TYPES.map((type) => (
          <div className="info-type" key={type.name}>
            <div className="info-type-header">
              <span className="dot" style={{ backgroundColor: type.color }} />
              <strong style={{ color: type.color }}>{type.name}</strong>
            </div>
            <p>{type.description}</p>
          </div>
        ))}
      </div>

      <div className="info-section">
        <h4>Key Concepts</h4>
        <div className="info-concept">
          <strong>Aspect Ratios</strong>
          <p>
            1.43:1 (full IMAX) vs 1.90:1 (digital IMAX). Full IMAX fills
            dramatically taller screens. Only 15/70mm film and GT Laser systems
            support 1.43:1.
          </p>
        </div>
        <div className="info-concept">
          <strong>"LieMAX"</strong>
          <p>
            Fan term for smaller IMAX screens with standard digital projectors.
            Not all IMAX theatres deliver the same experience — screen size and
            projector type matter. LieMAX theatres are not included on this
            site, as they don't deliver a better experience than most digital
            theatres today.
          </p>
        </div>
        <div className="info-concept">
          <strong>IMAX DMR</strong>
          <p>
            Digitally Re-Mastered films are converted to IMAX format in
            post-production, as opposed to films natively shot with IMAX
            cameras. DMR films benefit from IMAX screens but don't have the same
            resolution as native IMAX footage.
          </p>
        </div>
      </div>

      <div className="info-section">
        <h4>About This Data</h4>
        <p className="info-body">
          Venue data comes from the community-maintained{" "}
          <a
            href="https://imax.fandom.com/wiki/List_of_IMAX_venues"
            target="_blank"
            rel="noopener noreferrer"
          >
            IMAX Fandom Wiki
          </a>
          , which catalogs theatres with 15/70mm film projectors and/or 4K laser
          systems (GT Laser, Laser XT, CoLa, Dome Laser).
        </p>
        <p className="info-body">
          Theatres with only standard 2K digital xenon projectors are not
          included. These older systems offer little advantage over a regular
          cinema screen — the IMAX branding without the IMAX image quality.
        </p>
      </div>

      <div className="info-section">
        <h4>Additional Resources</h4>
        <ul className="info-links">
          {LINKS.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
                <span className="info-link-arrow">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
