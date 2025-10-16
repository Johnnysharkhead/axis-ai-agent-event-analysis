import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Sidebar.css"; 

const SECTIONS = [
  { title: "Video Feed", items: ["Live Camera", "Video Recording","Recording Library"] },
  { title: "2D Floorplan", items: ["Overview", "Heatmap", "Zones", "Schedule Alarms"] },
  { title: "AI Features", items: ["Axis Assistant", "Menu Item"] },
  { title: "Alarms", items: ["WILOO", "Menu Item"] },
];

function getPath(id) {
  if (id === "Dashboard") return "/dashboard";
  const [section, label] = id.split("|");
  return `/${section.toLowerCase().replace(/\s/g, "-")}/${label.toLowerCase().replace(/\s/g, "-")}`;
}

export default function Sidebar({ onSelect }) {
  const [activeId, setActiveId] = useState("Dashboard");
  const navigate = useNavigate();

  const select = (id, label) => {
    setActiveId(id);
    onSelect?.({ id, label });
    navigate(getPath(id));
  };

  const isActive = (id) => id === activeId;

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

