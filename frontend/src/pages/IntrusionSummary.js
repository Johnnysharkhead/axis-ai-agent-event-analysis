import React, { useMemo, useState } from "react";
import "../styles/pages.css";
import "../styles/eventHistory.css";
import { getCachedUser } from "../utils/userStorage";

const formatSinceLabel = (dateString) => {
  if (!dateString) return "since your last session";
  const ts = new Date(dateString);
  if (Number.isNaN(ts.getTime())) return "since your last session";

  const now = new Date();
  const diffMs = now - ts;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const mockDailySummaries = [
  {
    date: "2025-11-18",
    headline: "Perimeter remained stable; minor noise on Camera 2",
    summary:
      "No boundary crossings detected; cameras held connection and detection confidence remained nominal. Camera 2 registered brief motion at 02:14 and 02:29; both were classified as environmental noise.",
  },
  {
    date: "2025-11-17",
    headline: "Ingress matched 7-day baseline",
    summary:
      "Average ingress matched the prior 7-day baseline. No unusual heatmap clusters formed inside restricted zones. Zone A detection confidence averaged 96% with no false positives after 9pm.",
  },
  {
    date: "2025-11-25",
    headline: "Thief stealing cookies",
    summary:
      "Brief boundary crossing on Zone B at 23:42 flagged then dismissed as animal motion. All cameras maintained connectivity; highest jitter recorded on Camera 3 (42 ms).",
  },
];

const quickRangeOptions = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7days" },
  { label: "Last 30 days", value: "30days" },
  { label: "All", value: "all" },
];

export default function IntrusionSummary() {
  const user = getCachedUser();
  const sinceLabel = useMemo(() => formatSinceLabel(user?.last_login), [user]);
  const [selectedRange, setSelectedRange] = useState("7days");
  const [searchTerm, setSearchTerm] = useState("");

  const resolvedRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);

    if (selectedRange === "today") {
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    if (selectedRange === "7days") {
      start.setDate(now.getDate() - 7);
      return { from: start, to: now };
    }
    if (selectedRange === "30days") {
      start.setDate(now.getDate() - 30);
      return { from: start, to: now };
    }

    return { from: null, to: null };
  }, [selectedRange]);

  const filteredSummaries = useMemo(() => {
    const fromTs = resolvedRange.from ? resolvedRange.from.getTime() : null;
    const toTs = resolvedRange.to ? resolvedRange.to.getTime() : null;
    const term = searchTerm.trim();

    return mockDailySummaries
      .filter((item) => {
        const itemTs = new Date(item.date).getTime();
        if (Number.isNaN(itemTs)) return false;
        if (fromTs && itemTs < fromTs) return false;
        if (toTs && itemTs > toTs) return false;
        if (fromTs && itemTs < fromTs) return false;
        if (toTs && itemTs > toTs) return false;

        if (term) {
          const normalized = item.date;
          if (!normalized.includes(term)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [resolvedRange, searchTerm]);

  const handleResetFilters = () => {
    setSelectedRange("7days");
    setSearchTerm("");
  };

  return (
    <section className="page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Intrusion Summary</h1>
          <p className="subtitle">
            Natural-language summary of what the system has observed.
          </p>
        </header>
      </div>

      <div className="page__stack">
        <div className="page__section">
          <div className="event-history__filters event-history__filters--inline">
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

            <button type="button" className="event-history__reset event-history__reset--spaced" onClick={handleResetFilters}>
              Reset filters
            </button>
          </div>

          <div className="event-history__table-header" style={{ padding: 0 }}>
            <div>
              <h3 className="page__section-title">Daily summaries</h3>
            </div>
            <label htmlFor="summary-search" className="event-history__search">
              <span className="event-history__search-icon" aria-hidden>
                🔍
              </span>
              <input
                id="summary-search"
                type="search"
                placeholder="Search by date (YYYY-MM-DD)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
          </div>

          <div className="ai-day-list">
            {filteredSummaries.map((day) => (
              <article key={day.date} className="ai-day-card">
                <div className="ai-day-card__head">
                  <div>
                    <div className="ai-summary__eyebrow">{new Date(day.date).toLocaleDateString()}</div>
                    <h4 className="ai-day-card__title">{day.headline}</h4>
                  </div>
                </div>
                <p className="ai-day-card__summary">{day.summary}</p>
              </article>
            ))}

            {!filteredSummaries.length && <p className="recording-message">No summaries for this date range.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
