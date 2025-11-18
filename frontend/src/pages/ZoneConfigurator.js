import React, { useEffect, useState } from "react";
import "../styles/pages.css";
import RoomConfiguration from "../components/RoomConfiguration";
import ZoneConfigurator from "./ZoneConfigurator";

export default function Configuration() {
  // placeholder floorplans so the sidebar always has something to choose
  const [floorplans, setFloorplans] = useState([
    { id: "default", name: "Default 10×10 m", width: 10, depth: 10 },
    // add more placeholders if you want
  ]);
  const [selectedFloorplan, setSelectedFloorplan] = useState(floorplans[0]);

  useEffect(() => {
    // optional: try to load real floorplans, but fall back to placeholders
    fetch("/floorplan")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.floorplans && data.floorplans.length) {
          setFloorplans(data.floorplans);
          setSelectedFloorplan(data.floorplans[0]);
        }
      })
      .catch(() => {
        /* keep placeholders */
      });
  }, []);

  function handleSelect(e) {
    const id = e.target.value;
    const fp = floorplans.find((f) => String(f.id) === String(id));
    setSelectedFloorplan(fp || null);
  }

  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Configuration</h1>
        <p className="subtitle">Choose floorplan and draw zones</p>
      </header>

      <div className="page__split page__split--sidebar">
        <aside className="page__stack">
          <div className="page__section">
            <h3 className="page__section-title">Floorplans</h3>
            <select value={selectedFloorplan?.id || ""} onChange={handleSelect} style={{ width: "100%", padding: "0.6rem", borderRadius: 8 }}>
              {floorplans.map((fp) => (
                <option key={fp.id} value={fp.id}>
                  {fp.name || `Floorplan ${fp.id}`}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--color-muted)" }}>
              {floorplans.length} floorplans
            </div>
          </div>

          <div className="page__section">
            <h3 className="page__section-title">Room Configuration</h3>
            <RoomConfiguration onSave={() => {}} initialConfig={selectedFloorplan || { width: 10, depth: 10, cameraHeight: 2 }} />
          </div>
        </aside>

        <div className="page__section" style={{ padding: 20 }}>
          <h3 className="page__section-title">Zone Configurator</h3>
          <p className="page__section-subtitle">Select a floorplan on the left, then draw rectangles on the map.</p>

          <div style={{ marginTop: 12 }}>
            <ZoneConfigurator selectedFloorplan={selectedFloorplan} />
          </div>
        </div>
      </div>
    </section>
  );
}