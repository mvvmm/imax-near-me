import { useState } from "react";
import type { Filters as FiltersType, FilterKey } from "../types";

interface Props {
  filters: FiltersType;
  onToggle: (key: FilterKey) => void;
  venueCount: number;
  totalCount: number;
  showInfo: boolean;
  onToggleInfo: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

const FILTER_OPTIONS: { key: FilterKey; label: string; color: string }[] = [
  { key: "film", label: "15/70mm Film", color: "#ef4444" },
  { key: "gtLaser", label: "GT Laser", color: "#f59e0b" },
  { key: "laser", label: "Laser", color: "#3b82f6" },
  { key: "dome", label: "Dome", color: "#a855f7" },
];

export function Filters({
  filters,
  onToggle,
  venueCount,
  totalCount,
  showInfo,
  onToggleInfo,
  theme,
  onToggleTheme,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`filters-panel ${collapsed ? "filters-collapsed" : ""}`}>
      <div className="filters-header">
        <h1>IMAX Near Me</h1>
        <div className="filters-header-actions">
          <button
            className={`info-toggle ${showInfo ? "active" : ""}`}
            onClick={onToggleInfo}
            aria-label="Toggle info panel"
            title="About IMAX projectors"
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
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
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
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
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
          <button
            className="filters-collapse-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Show filters" : "Hide filters"}
          >
            <svg
              className="collapse-chevron"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2.5 4.5L6 8L9.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="filters-body">
        <div className="filters-body-inner">
          <div className="filters-subtitle">Filter by projector</div>
          <div className="filter-buttons">
            {FILTER_OPTIONS.map(({ key, label, color }) => (
              <button
                key={key}
                className={`filter-btn ${filters[key] ? "active" : ""}`}
                style={{
                  borderColor: filters[key]
                    ? color
                    : "var(--inactive-border)",
                  backgroundColor: filters[key] ? `${color}22` : "transparent",
                  color: filters[key] ? color : "var(--inactive-text)",
                  "--filter-bg-hover": filters[key] ? `${color}33` : "var(--btn-bg-hover)",
                  "--filter-border-hover": filters[key] ? color : "var(--btn-border-hover)",
                  "--filter-color-hover": filters[key] ? color : "var(--btn-text-hover)",
                } as React.CSSProperties}
                onClick={() => onToggle(key)}
              >
                <span
                  className="dot"
                  style={{
                    backgroundColor: filters[key]
                      ? color
                      : "var(--inactive-dot)",
                  }}
                />
                {label}
              </button>
            ))}
          </div>
          <div className="venue-count">
            <strong>{venueCount}</strong> of {totalCount} venues
          </div>
        </div>
      </div>
    </div>
  );
}
