import React from "react";
import MainLayout from "../layouts/MainLayout";
import "../styles/pages.css";

const dashboardTiles = [
  { key: "cameras", placeholder: "Camera feeds", label: "Cameras" },
  { key: "alarms", placeholder: "Alarm overview", label: "Alarms" },
  { key: "floormap", placeholder: "2D floorplan", label: "2D Floorplan" },
  { key: "assistant", placeholder: "Assistant shortcut", label: "Ask Axis Assistant", tall: true },
  { key: "schedule", placeholder: "Schedule summary", label: "Schedule Zones", wide: true, tall: true }
];

function Dashboard() {
  return (
    
      <section className="page">
        <header className="header">
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">Product overview will be implemented here. This is just examples of what could be here later :)</p>
        </header>

        <div className="page__placeholder-grid page__placeholder-grid--spaced">
          {dashboardTiles.map(({ key, placeholder, label, wide, tall }) => (
            <div
              key={key}
              className={`page__placeholder-card${wide ? " page__placeholder-card--wide" : ""}${
                tall ? " page__placeholder-card--tall" : ""
              }`}
            >
              <div className="page__placeholder">{placeholder}</div>
              <span className="page__placeholder-label">{label}</span>
            </div>
          ))}
        </div>
      </section>
  
  );
}

export default Dashboard;
