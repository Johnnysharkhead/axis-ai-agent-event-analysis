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
  const handleReset = () => {
    setCurrentColor(null);
    setCurrentTool("paint");
  };

  return (
    <section className="page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Floormap 2D</h1>
          <p className="subtitle">
            Build layouts, zones and alarm schedules from a single surface. Currently viewing: {view}.
          </p>
          <p>And then maybe separate tabs for defining zones, heatmaps, alarms etc. Or per camera?</p>
        </header>

        
      </div>

      <div className="page__section">
        {view === "configuration" && (
          <div className="floormap__control-row">
            <ColorButton
              buttonColorSelected="#2563eb"
              paintingColor="blue"
              currentColor={currentColor}
              onChange={setCurrentColor}
              activeText="Place Room Zone"
            />
            <ColorButton
              buttonColorSelected="#0ea5e9"
              paintingColor="red"
              currentColor={currentColor}
              onChange={setCurrentColor}
              activeText="Place Camera Zone"
            />
            <ColorButton
              buttonColorSelected="#ef4444"
              paintingColor="#000000"
              currentColor={currentColor}
              onChange={setCurrentColor}
              activeText="Delete Zone"
            />
            <div className="floormap__control-row floormap__control-row--end">
              <ChangeToolButton currentTool={currentTool} onChange={setCurrentTool} />
            </div>
          </div>
        )}

        <div className="page__placeholder page__placeholder--xlarge page__placeholder--floormap">
          {view === "configuration" && (
            <Gridmap rows={15} cols={35} currentColor={currentColor} currentTool={currentTool} />
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
