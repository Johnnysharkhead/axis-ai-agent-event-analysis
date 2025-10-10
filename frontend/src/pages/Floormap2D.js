import React from "react";
import "../styles/pages.css";

function Floormap2D({ view }) {
  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Floormap 2D</h1>
        <p className="subtitle">View: {view}</p>
        <p>And then maybe separate tabs for defining zones, heatmaps, alarms etc. Or per camera?</p>
      </header>

      <div className="page__placeholder-stack">
        <div className="page__placeholder page__placeholder--xlarge page__placeholder--floormap">
          {view === "overview" && "Overview Content"}
          {view === "heatmap" && "Heatmap Content"}
          {view === "zones" && "Zones Content"}
          {view === "schedule-alarms" && "Schedule Alarms Content"}
        </div>
      </div>
    </section>
  );
}


export default Floormap2D;
