import React, { useEffect, useRef, useState } from "react";
import "../styles/pages.css";

/**
 * ZoneConfiguration page
 * - Left sidebar: choose a floorplan (placeholder) + "Save Zone Configuration" button
 * - Right: proportional 10×10 map that fits viewport and supports drawing rectangles
 * - Zones persisted in localStorage under key `zones_floorplan_{id}`
 * - Zones are named A, B, C, ... AA, AB, ... and renumber when deleted
 * - Each zone gets a distinct color
 */

function indexToLetters(idx) {
  // 0 -> A, 25 -> Z, 26 -> AA (Excel-style)
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function zoneColor(i) {
  const h = (i * 57) % 360; // spread hues
  const border = `hsl(${h} 75% 35%)`;
  const bg = `hsl(${h} 75% 50% / 0.12)`;
  return { border, bg };
}

export default function ZoneConfiguration() {
  const placeholderPlans = [{ id: "default", name: "Default 10×10 m", width: 10, depth: 10 }];
  const [floorplans, setFloorplans] = useState(placeholderPlans);
  const [selectedFloorplan, setSelectedFloorplan] = useState(placeholderPlans[0]);

  const roomWidth = selectedFloorplan?.width || 10;
  const roomDepth = selectedFloorplan?.depth || 10;
  const planId = selectedFloorplan?.id ?? "default";

  const [zones, setZones] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [preview, setPreview] = useState(null);
  const startRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // try load real floorplans, fall back to placeholder
    fetch("/floorplan")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.floorplans && data.floorplans.length) {
          setFloorplans(data.floorplans);
          setSelectedFloorplan(data.floorplans[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(`zones_floorplan_${planId}`);
    try {
      setZones(raw ? JSON.parse(raw) : []);
    } catch {
      setZones([]);
    }
  }, [planId]);

  function saveZones(next) {
    // ensure names are sequential A, B, ...
    const renamed = (next || []).map((z, i) => ({ ...z, name: indexToLetters(i) }));
    setZones(renamed);
    try {
      localStorage.setItem(`zones_floorplan_${planId}`, JSON.stringify(renamed));
    } catch {}
  }

  function pageToRoom(clientX, clientY) {
    if (!containerRef.current) return { normalizedX: 0, normalizedY: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const normalizedX = Math.max(0, Math.min(roomWidth, (px / rect.width) * roomWidth));
    const normalizedY = Math.max(0, Math.min(roomDepth, roomDepth - (py / rect.height) * roomDepth));
    return { normalizedX, normalizedY };
  }

  function pointerStart(clientX, clientY) {
    if (!drawMode) return;
    startRef.current = pageToRoom(clientX, clientY);
    setIsDrawing(true);
    setPreview(null);
  }
  function pointerMove(clientX, clientY) {
    if (!isDrawing || !startRef.current) return;
    const start = startRef.current;
    const cur = pageToRoom(clientX, clientY);
    const left = Math.min(start.normalizedX, cur.normalizedX);
    const right = Math.max(start.normalizedX, cur.normalizedX);
    const bottom = Math.min(start.normalizedY, cur.normalizedY);
    const top = Math.max(start.normalizedY, cur.normalizedY);
    setPreview({ x: left, y: bottom, w: right - left, h: top - bottom });
  }
  function pointerEnd(clientX, clientY) {
    if (!isDrawing || !startRef.current) return;
    const start = startRef.current;
    const cur = pageToRoom(clientX, clientY);
    const left = Math.min(start.normalizedX, cur.normalizedX);
    const right = Math.max(start.normalizedX, cur.normalizedX);
    const bottom = Math.min(start.normalizedY, cur.normalizedY);
    const top = Math.max(start.normalizedY, cur.normalizedY);
    const w = right - left;
    const h = top - bottom;
    setIsDrawing(false);
    setPreview(null);
    startRef.current = null;
    if (w < 0.01 || h < 0.01) return;
    const newZone = { id: Date.now(), x: left, y: bottom, w, h };
    saveZones([...zones, newZone]);
  }

  // pointer handlers
  function onMouseDown(e) { pointerStart(e.clientX, e.clientY); }
  function onMouseMove(e) { pointerMove(e.clientX, e.clientY); }
  function onMouseUp(e) { pointerEnd(e.clientX, e.clientY); }
  function onTouchStart(e) { if (e.touches?.[0]) pointerStart(e.touches[0].clientX, e.touches[0].clientY); }
  function onTouchMove(e) { if (e.touches?.[0]) pointerMove(e.touches[0].clientX, e.touches[0].clientY); }
  function onTouchEnd(e) { const t = e.changedTouches?.[0]; if (t) pointerEnd(t.clientX, t.clientY); }

  function clearZones() {
    saveZones([]);
  }

  function exportSave() {
    try {
      localStorage.setItem(`zones_floorplan_${planId}`, JSON.stringify(zones));
      alert("Zones saved");
    } catch {
      alert("Save failed");
    }
  }

  function zoneStyle(z, i) {
    const { border, bg } = zoneColor(i);
    const leftPct = (z.x / Math.max(1, roomWidth)) * 100;
    const bottomPct = (z.y / Math.max(1, roomDepth)) * 100;
    const wPct = (z.w / Math.max(1, roomWidth)) * 100;
    const hPct = (z.h / Math.max(1, roomDepth)) * 100;
    return {
      position: "absolute",
      left: `${leftPct}%`,
      bottom: `${bottomPct}%`,
      width: `${wPct}%`,
      height: `${hPct}%`,
      border: `2px solid ${border}`,
      backgroundColor: bg,
      boxSizing: "border-box",
      pointerEvents: "none",
    };
  }

  const wrapperStyle = { width: "90vw", maxWidth: 900, margin: "0 auto" };
  const containerStyle = {
    position: "relative",
    width: "100%",
    paddingBottom: `${(roomDepth / Math.max(1, roomWidth)) * 100}%`,
    border: "2px solid var(--color-border)",
    borderRadius: 12,
    background: "var(--color-surface)",
    touchAction: "none",
  };

  function handleSelect(e) {
    const id = e.target.value;
    const fp = floorplans.find((f) => String(f.id) === String(id));
    setSelectedFloorplan(fp || null);
  }

  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Zone Configuration</h1>
        <p className="subtitle">Draw rectangles on the map and press "Save Zone Configuration"</p>
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
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--color-muted)" }}>{floorplans.length} floorplans</div>
          </div>

          <div className="page__section">
            <h3 className="page__section-title">Zone Configuration</h3>
            <div style={{ marginTop: 12 }}>
              <button className="page__control" onClick={exportSave} style={{ width: "100%" }}>
                Save Zone Configuration
              </button>
            </div>
          </div>
        </aside>

        <div className="page__section" style={{ padding: 20 }}>
          <h3 className="page__section-title">Map</h3>
          <p className="page__section-subtitle">10×10 m placeholder — map fits viewport proportionally</p>

          <div style={{ marginTop: 12 }}>
            <div style={wrapperStyle}>
              {/* toolbar placed above the floorplan (inside wrapper) */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8, justifyContent: "flex-start" }}>
                <button className="page__control" onClick={() => setDrawMode((d) => !d)}>
                  {drawMode ? "Exit draw" : "Draw rectangle"}
                </button>
                <button className="page__control" onClick={clearZones} style={{ background: "#ef4444", color: "white" }}>
                  Clear zones
                </button>
              </div>

              <div
                ref={containerRef}
                style={containerStyle}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div style={{ position: "absolute", inset: 0 }}>
                  {zones.map((z, i) => (
                    <div key={z.id} style={zoneStyle(z, i)} title={z.name} />
                  ))}

                  {preview && (
                    <div
                      style={{
                        position: "absolute",
                        left: `${(preview.x / Math.max(1, roomWidth)) * 100}%`,
                        bottom: `${(preview.y / Math.max(1, roomDepth)) * 100}%`,
                        width: `${(preview.w / Math.max(1, roomWidth)) * 100}%`,
                        height: `${(preview.h / Math.max(1, roomDepth)) * 100}%`,
                        backgroundColor: "rgba(37,99,235,0.12)",
                        border: "2px solid rgba(37,99,235,0.9)",
                        boxSizing: "border-box",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {zones.length === 0 ? (
                <p style={{ color: "var(--color-muted)" }}>No zones defined</p>
              ) : (
                zones.map((z, i) => {
                  const { border } = zoneColor(i);
                  return (
                    <div key={z.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, background: "var(--color-surface)", borderRadius: 6, marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${border}` }} />
                        <div>
                          <strong>{z.name}</strong>
                          <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                            {z.x.toFixed(2)}m, {z.y.toFixed(2)}m — {z.w.toFixed(2)}m × {z.h.toFixed(2)}m
                          </div>
                        </div>
                      </div>
                      <button onClick={() => saveZones(zones.filter((s) => s.id !== z.id))} style={{ background: "#ff4d4d", color: "white", border: "none", padding: "6px 8px", borderRadius: 6 }}>
                        Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}