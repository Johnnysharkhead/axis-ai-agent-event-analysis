import React, { useMemo, useState } from "react";
import "../styles/pages.css";
import "../styles/eventHistory.css";

const quickRangeOptions = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7days" },
  { label: "Last 30 days", value: "30days" },
  { label: "All events", value: "all" },
];

const createThumbnail = (label, gradient) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${gradient[0]}" />
          <stop offset="100%" stop-color="${gradient[1]}" />
        </linearGradient>
      </defs>
      <rect width="96" height="64" rx="10" fill="url(#grad)" />
      <circle cx="26" cy="22" r="10" fill="rgba(15,23,42,0.18)" />
      <rect x="20" y="26" width="44" height="24" rx="8" fill="rgba(255,255,255,0.28)" />
      <text x="70" y="32" dominant-baseline="middle" text-anchor="middle"
        font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="9"
        fill="rgba(248,250,252,0.95)"
        transform="rotate(-90 70 32)">
        ${label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

function createMockEvents() {
  const thumbnails = {
    entranceHall: createThumbnail("Entrance", ["#2563eb", "#4f46e5"]),
    loadingDock: createThumbnail("Dock", ["#0ea5e9", "#6366f1"]),
    northWing: createThumbnail("North", ["#f97316", "#ef4444"]),
    warehouse: createThumbnail("Warehouse", ["#14b8a6", "#0f172a"]),
    parkingDeck: createThumbnail("Parking", ["#8b5cf6", "#6366f1"]),
  };

  const now = new Date();
  const toDate = ({ days = 0, hours = 0 }) => new Date(now.getTime() - (days * 24 + hours) * 60 * 60 * 1000);

  return [
    {
      id: "EVT-10452",
      timestamp: toDate({ hours: 2 }),
      camera: "Entrance Hall",
      zone: "Lobby",
      thumbnail: thumbnails.entranceHall,
    },
    {
      id: "EVT-10438",
      timestamp: toDate({ days: 1, hours: 4 }),
      camera: "Loading Dock",
      zone: "Delivery Zone",
      thumbnail: thumbnails.loadingDock,
    },
    {
      id: "EVT-10397",
      timestamp: toDate({ days: 3, hours: 6 }),
      camera: "North Wing",
      zone: "Corridor 2B",
      thumbnail: thumbnails.northWing,
    },
    {
      id: "EVT-10376",
      timestamp: toDate({ days: 9, hours: 2 }),
      camera: "Warehouse",
      zone: "Inventory Aisle",
      thumbnail: thumbnails.warehouse,
    },
    {
      id: "EVT-10341",
      timestamp: toDate({ days: 16, hours: 5 }),
      camera: "Parking Deck",
      zone: "Level B2",
      thumbnail: thumbnails.parkingDeck,
    },
  ];
}

function formatTimestamp(date) {
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateFormatter.format(date)} • ${timeFormatter.format(date)}`;
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function EventHistoryPage() {
  const [selectedRange, setSelectedRange] = useState("7days");
  const [searchTerm, setSearchTerm] = useState("");

  const mockEvents = useMemo(() => createMockEvents(), []);
  const now = useMemo(() => new Date(), []);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mockEvents
      .filter((event) => {
        if (selectedRange !== "all") {
          const diffMs = now.getTime() - event.timestamp.getTime();
          switch (selectedRange) {
            case "today": {
              const sameYear = event.timestamp.getFullYear() === now.getFullYear();
              const sameMonth = event.timestamp.getMonth() === now.getMonth();
              const sameDate = event.timestamp.getDate() === now.getDate();
              if (!(sameYear && sameMonth && sameDate)) return false;
              break;
            }
            case "7days": {
              if (diffMs > 7 * 24 * 60 * 60 * 1000) return false;
              break;
            }
            case "30days": {
              if (diffMs > 30 * 24 * 60 * 60 * 1000) return false;
              break;
            }
            default:
              break;
          }
        }

        if (normalizedSearch) {
          const haystack = (
            `${event.id} ${event.camera} ${event.zone} ${event.timestamp.toISOString()} ${formatTimestamp(event.timestamp)}`
          ).toLowerCase();
          if (!haystack.includes(normalizedSearch)) return false;
        }

        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [mockEvents, now, searchTerm, selectedRange]);

  const handleResetFilters = () => {
    setSelectedRange("7days");
    setSearchTerm("");
  };

  const handleExport = () => {
    const header = ["Event ID", "Timestamp", "Camera", "Zone"];
    const rows = filteredEvents.length ? filteredEvents : mockEvents;
    const csv = [header, ...rows.map((event) => [
      escapeCsvValue(event.id),
      escapeCsvValue(event.timestamp.toISOString()),
      escapeCsvValue(event.camera),
      escapeCsvValue(event.zone),
    ])]
      .map((line) => line.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `event-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="page event-history">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Alarm History</h1>
          <p className="subtitle">
            Review previously detected intrusion events.
          </p>
        </header>

        <div className="page__controls">
          <button type="button" className="page__control page__control--primary" onClick={handleExport}>
            Export report
          </button>
          <button type="button" className="page__control">
            Manage alerts
          </button>
        </div>
      </div>

      <div className="event-history__grid">
        <aside className="event-history__card event-history__filters">
          <h2 className="event-history__card-title">Filters</h2>

          <div className="event-history__filter-group">
            <span className="event-history__filter-label">Quick range</span>
            <div className="event-history__pill-group">
              {quickRangeOptions.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={`event-history__pill${selectedRange === value ? " event-history__pill--active" : ""}`}
                  onClick={() => setSelectedRange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="event-history__reset" onClick={handleResetFilters}>
            Reset filters
          </button>
        </aside>

        <div className="event-history__card event-history__table-card">
          <div className="event-history__table-header">
            <div>
              <h2 className="event-history__card-title">Recent intrusion events</h2>
            </div>
            <label htmlFor="event-search" className="event-history__search">
              <span className="event-history__search-icon" aria-hidden>
                🔍
              </span>
              <input
                id="event-search"
                type="search"
                placeholder="Search by camera, zone, or event ID"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                />
            </label>
          </div>

          <div className="event-history__table">
            <div className="event-history__table-row event-history__table-row--head">
              <span>Snapshot</span>
              <span>ID</span>
              <span>Timestamp</span>
              <span>Camera</span>
              <span>Zone</span>
            </div>

            {filteredEvents.length === 0 && (
              <div className="event-history__table-empty">
                No events match the selected filters yet.
              </div>
            )}

            {filteredEvents.map((event) => (
              <div key={event.id} className="event-history__table-row">
                <span className="event-history__snapshot">
                  <img src={event.thumbnail} alt={`${event.camera} snapshot`} loading="lazy" />
                </span>
                <span className="event-history__event-id">{event.id}</span>
                <span>{formatTimestamp(event.timestamp)}</span>
                <span>{event.camera}</span>
                <span>{event.zone}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default EventHistoryPage;
