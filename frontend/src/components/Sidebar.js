import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axisTriangle from "../assets/axis-triangle.png";
import "../styles/Sidebar.css";

const SECTIONS = [
  {
    title: "Video Feed",
    items: ["Live Feed", "Video Recording", "Recording Library"],
  },
  {
    title: "2D Floorplan",
    items: ["Floorplan", "Zones", "Schedule Alarms", "Camera Configure"],
  },
  { title: "AI Features", items: ["Intrusion Summary"] },
  { title: "Alarms", items: ["Alarm History"] },
];

function getPath(id) {
  if (id === "Dashboard") return "/dashboard";
  if (id === "2D Floorplan|Camera Configure") return "/cameras/configure";

  const [section, label] = id.split("|");
  return `/${section.toLowerCase().replace(/\s/g, "-")}/${label
    .toLowerCase()
    .replace(/\s/g, "-")}`;
}
// NEW: helper to resolve the API base URL in a reusable way
function getApiBase() {
  return (
    process.env.REACT_APP_API_URL ||
    process.env.API_URL ||
    `${window.location.protocol}//${window.location.hostname}:5001`
  );
}

function Sidebar({ onSelect }) {
  const location = useLocation();
  const [activeId, setActiveId] = useState(() =>
    inferIdFromPath(location.pathname)
  );
  const navigate = useNavigate();

  const select = (id, label) => {
    setActiveId(id);
    onSelect?.({ id, label });
    navigate(getPath(id));
  };

  const isActive = (id) => id === activeId;

  useEffect(() => {
    const inferred = inferIdFromPath(location.pathname);
    if (inferred !== activeId) {
      setActiveId(inferred);
    }
  }, [location.pathname, activeId]);

  // CHANGED: this now starts the backend *loop* instead of one-shot /play
  const testSpeaker = async () => {
    const apiBase = getApiBase(); // CHANGED: use helper

    try {
      const res = await fetch(`${apiBase}/api/alarm/loop/start`, {
        // CHANGED: /loop/start instead of /play
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Read raw body for better diagnostics, then try to parse JSON
      const raw = await res.text();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch (e) {
        // not JSON - we'll still include the text in error messages
      }

      if (!res.ok || data.ok === false) {
        const errMsg =
          data.error || data.message || raw || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      // CHANGED: message now reflects repeating loop, not just one shot
      const info = data.message ? ` (${data.message})` : "";
      alert(`Alarm started and will repeat every 30 seconds.${info}`);
    } catch (err) {
      console.error("Failed to start alarm loop:", err); // log text
      alert(`Failed to start alarm loop: ${err.message}`);
    }
  };

  // NEW: stop button handler – calls /api/alarm/stop
  const stopAlarmLoop = async () => {
    const apiBase = getApiBase();

    try {
      const res = await fetch(`${apiBase}/api/alarm/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const raw = await res.text();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch (e) {
        // ignore parse errors – raw will still be used in error if needed
      }

      if (!res.ok || data.ok === false) {
        const errMsg =
          data.error || data.message || raw || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      alert(data.message || "Alarm loop stopped.");
    } catch (err) {
      console.error("Failed to stop alarm loop:", err);
      alert(`Failed to stop alarm loop: ${err.message}`);
    }
  };

  return (
    <aside className="sidebar">
      <button
        onClick={() => select("Dashboard", "Dashboard")}
        className={`sidebar-dashboard ${isActive("Dashboard") ? "active" : ""}`}
      >
        <span aria-hidden className="sidebar-dashboard-icon">
          <img src={axisTriangle} alt="" />
        </span>
        Dashboard
      </button>
      {SECTIONS.map((section) => (
        <div key={section.title} className="sidebar-section">
          <div className="sidebar-section-title">{section.title}</div>
          {section.items.map((label) => {
            const id = `${section.title}|${label}`;
            const active = isActive(id);
            return (
              <div key={id} className="sidebar-row">
                <button
                  className={`sidebar-radio ${active ? "active" : ""}`}
                  onClick={() => select(id, label)}
                  aria-label={label}
                  aria-pressed={active}
                />
                <button
                  className={`sidebar-item ${active ? "active" : ""}`}
                  onClick={() => select(id, label)}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {/*
      --- Alarm controls section temporarily disabled ---
      <div className="sidebar-section">
        <div className="sidebar-section-title">Test Button</div>

        <div className="sidebar-row">
          <button
            className={`sidebar-radio`}
            aria-label="Start Alarm"
            aria-pressed={false}
          />
          <button className={`sidebar-item`} onClick={testSpeaker}>
            🔊 Start Alarm
          </button>
        </div>

        <div className="sidebar-row">
          <button
            className={`sidebar-radio`}
            aria-label="Stop Alarm"
            aria-pressed={false}
          />
          <button className={`sidebar-item`} onClick={stopAlarmLoop}>
            ⏹ Stop Alarm
          </button>
        </div>
      </div>
      */}
    </aside>
  );
}

function slugify(value) {
  return value.toLowerCase().replace(/\s/g, "-");
}

function inferIdFromPath(pathname) {
  if (pathname === "/dashboard" || pathname === "/home") {
    return "Dashboard";
  }
  if (pathname.startsWith("/cameras/configure")) {
    return "2D Floorplan|Camera Configure";
  }

  for (const section of SECTIONS) {
    for (const label of section.items) {
      const generatedPath = `/${slugify(section.title)}/${slugify(label)}`;
      if (pathname.startsWith(generatedPath)) {
        return `${section.title}|${label}`;
      }
    }
  }

  return "Dashboard";
}
export default Sidebar;
