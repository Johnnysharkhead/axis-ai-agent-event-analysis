/**
 * Floormap2D.js 
 * Page for displaying and configuring a 2D floor map. passed a "view" prop to determine which view to show. 
 */
import React, { useState } from "react";
import "../styles/pages.css";
import Gridmap from "../components/Gridmap";
import ColorButton from "../components/ColorButton";
import ChangeToolButton from "../components/ChangeToolButton";

function Floormap2D({ view }) {
  const [currentTool, setCurrentTool] = useState("paint"); //shared painting state
  const [currentColor, setCurrentColor] = useState(null); // shared color state

  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Floormap 2D</h1>
        <p className="subtitle">View: {view}</p>
        <p>
          And then maybe separate tabs for defining zones, heatmaps, alarms etc.
          Or per camera?
        </p>

        {/* Pass state updater to ColorButton and a default color */}
        {/** Only show color and tool buttons in configuration view */}
        {view === "configuration" && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "1rem",
              flexWrap: "wrap",
            }}
          >
            <ColorButton
              buttonColorSelected="#696969"
              paintingColor="blue"
              currentColor={currentColor}
              onChange={setCurrentColor}
              activeText="Place Room Zone"
            />
            <ColorButton
              buttonColorSelected="#696969"
              paintingColor="red"
              currentColor={currentColor}
              onChange={setCurrentColor}
              activeText="Place Camera Zone"
            />
            <ColorButton
              buttonColorSelected="red"
              paintingColor="#000000"
              currentColor={currentColor}
              onChange={setCurrentColor}
              activeText="Delete Zone"
            />
            <ChangeToolButton
              currentTool={currentTool}
              onChange={setCurrentTool}
            />
          </div>
        )}
      </header>

      <div className="page__placeholder-stack">
        <div className="page__placeholder page__placeholder--xlarge page__placeholder--floormap">
          {view === "configuration" && (
            <Gridmap
              rows={15}
              cols={35}
              currentColor={currentColor}
              currentTool={currentTool}
            />
          )}
          {view === "heatmap" && "Heatmap Content"}
          {view === "zones" && "Zones Content"}
          {view === "schedule-alarms" && "Schedule Alarms Content"}
        </div>
      </div>
    </section>
  );
}

export default Floormap2D;
