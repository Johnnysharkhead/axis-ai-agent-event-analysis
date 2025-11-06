import React from "react";
import "../styles/pages.css";
import "../styles/eventHistory.css";

const mockEvents = [
  {
    id: "EVT-10452",
    timestamp: "2024-10-14 • 19:24",
    camera: "Entrance Hall",
    zone: "Lobby",
    severity: "High",
    status: "Acknowledged",
  },
  {
    id: "EVT-10438",
    timestamp: "2024-10-14 • 17:42",
    camera: "Loading Dock",
    zone: "Delivery Zone",
    severity: "Medium",
    status: "Pending Review",
  },
  {
    id: "EVT-10397",
    timestamp: "2024-10-14 • 15:03",
    camera: "North Wing",
    zone: "Corridor 2B",
    severity: "Critical",
    status: "Escalated",
  },
  {
    id: "EVT-10376",
    timestamp: "2024-10-14 • 14:11",
    camera: "Warehouse",
    zone: "Inventory Aisle",
    severity: "Low",
    status: "Resolved",
  },
];

function EventHistoryPage() {
  return (
    <section className="page event-history">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Event History</h1>
          <p className="subtitle">
            Review previously detected intrusion events. Filters and exports will be connected once
            the event service is available.
          </p>
        </header>

        <div className="page__controls">
          <button type="button" className="page__control page__control--primary">
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
              <button type="button" className="event-history__pill event-history__pill--active">
                Today
              </button>
              <button type="button" className="event-history__pill">Last 7 days</button>
              <button type="button" className="event-history__pill">Custom…</button>
            </div>
          </div>

          <div className="event-history__filter-group">
            <span className="event-history__filter-label">Event type</span>
            <div className="event-history__checkbox-list">
              {["Intrusion", "Loitering", "Perimeter breach"].map((label) => (
                <label key={label} className="event-history__checkbox">
                  <input type="checkbox" disabled />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="event-history__filter-group">
            <span className="event-history__filter-label">Status</span>
            <div className="event-history__status-badges">
              {["Escalated", "Pending", "Acknowledged", "Resolved"].map((status) => (
                <span key={status} className="event-history__status-badge">
                  {status}
                </span>
              ))}
            </div>
          </div>

          <button type="button" className="event-history__reset">
            Reset filters
          </button>
        </aside>

        <div className="event-history__card event-history__table-card">
          <div className="event-history__table-header">
            <div>
              <h2 className="event-history__card-title">Recent events</h2>
              <p className="event-history__card-subtitle">
                Sample data to illustrate the upcoming timeline and audit trail.
              </p>
            </div>
            <label htmlFor="event-search" className="event-history__search">
              <span className="event-history__search-icon" aria-hidden>
                🔍
              </span>
              <input
                id="event-search"
                type="search"
                placeholder="Search by camera, zone, or event ID"
                disabled
              />
            </label>
          </div>

          <div className="event-history__table">
            <div className="event-history__table-row event-history__table-row--head">
              <span>ID</span>
              <span>Timestamp</span>
              <span>Camera</span>
              <span>Zone</span>
              <span>Severity</span>
              <span>Status</span>
            </div>

            {mockEvents.map((event) => (
              <div key={event.id} className="event-history__table-row">
                <span className="event-history__event-id">{event.id}</span>
                <span>{event.timestamp}</span>
                <span>{event.camera}</span>
                <span>{event.zone}</span>
                <span>
                  <span className={`event-history__severity event-history__severity--${event.severity.toLowerCase()}`}>
                    {event.severity}
                  </span>
                </span>
                <span>{event.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default EventHistoryPage;
