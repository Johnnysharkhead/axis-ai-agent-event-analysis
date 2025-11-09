import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Sidebar.css"; 

const SECTIONS = [
  { title: "Video Feed", items: ["Live Camera", "Video Recording","Recording Library"] },
  { title: "2D Floorplan", items: ["Configuration", "Heatmap", "Zones", "Schedule Alarms"] },
  { title: "AI Features", items: ["Intrusion Summary"] },
  { title: "Alarms", items: ["Alarm History"] },
];

function getPath(id) {
  if (id === "Dashboard") return "/dashboard";
  const [section, label] = id.split("|");
  return `/${section.toLowerCase().replace(/\s/g, "-")}/${label.toLowerCase().replace(/\s/g, "-")}`;
}

export default function Sidebar({ onSelect }) {
  const location = useLocation();
  const [activeId, setActiveId] = useState(() => inferIdFromPath(location.pathname));
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

  return (
    <aside className="sidebar">
      <button
        onClick={() => select("Dashboard", "Dashboard")}
        className={`sidebar-dashboard ${isActive("Dashboard") ? "active" : ""}`}
      >
        <span aria-hidden>📊</span> Dashboard
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
