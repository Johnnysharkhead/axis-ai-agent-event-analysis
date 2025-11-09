import React from "react";
import "../styles/pages.css";

const dashboardTiles = [
  { key: "cameras", placeholder: "Camera feeds", label: "Cameras" },
  { key: "alarms", placeholder: "Alarm overview", label: "Alarms" },
  { key: "floormap", placeholder: "2D floorplan", label: "2D Floorplan" },
  { key: "assistant", placeholder: "Assistant shortcut", label: "Ask Axis Assistant" },
  { key: "schedule", placeholder: "Schedule summary", label: "Schedule Zones" },
  { key: "health", placeholder: "System health", label: "System Health" },
];

function Dashboard() {
  return (
    <section className="page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">
            Product overview will be implemented here. This is just examples of what could be here later :)
          </p>
        </header>
      </div>

      
        <div className="page__placeholder-grid page__placeholder-grid--spaced">
          {dashboardTiles.map(({ key, placeholder, label }) => (
            <div key={key} className="page__placeholder-card page__placeholder-card--uniform">
              <div className="page__placeholder">{placeholder}</div>
              <span className="page__placeholder-label">{label}</span>
            </div>
          ))}
        </div>
      
    </section>
  );
}

export default Dashboard;
