import React, { useEffect, useRef, useState } from "react";
import "../styles/pages.css";

function indexToLetters(idx) {
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
  const h = (i * 57) % 360;
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

  // Zones are polygons: { id, points: [{x,y}, ...], name }
  const [zones, setZones] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [currentVerts, setCurrentVerts] = useState([]); // building polygon
  const [previewPoint, setPreviewPoint] = useState(null); // live mouse pos while drawing
  const containerRef = useRef(null);

  useEffect(() => {
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
      const loaded = raw ? JSON.parse(raw) : [];
      setZones(loaded);
    } catch {
      setZones([]);
    }
  }, [planId]);

  function persistAndRename(next) {
    const renamed = (next || []).map((z, i) => ({ ...z, name: indexToLetters(i) }));
    setZones(renamed);
    try {
      localStorage.setItem(`zones_floorplan_${planId}`, JSON.stringify(renamed));
    } catch {}
  }

  function pageToRoom(clientX, clientY) {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const x = Math.max(0, Math.min(roomWidth, (px / rect.width) * roomWidth));
    const y = Math.max(0, Math.min(roomDepth, roomDepth - (py / rect.height) * roomDepth));
    return { x, y };
  }

  // add vertex on click
  function onMapClick(e) {
    if (!drawMode) return;
    // ignore if clicking toolbar etc.
    const p = pageToRoom(e.clientX, e.clientY);
    setCurrentVerts((v) => [...v, p]);
    setPreviewPoint(null);
  }

  // live preview line while moving mouse
  function onMapMouseMove(e) {
    if (!drawMode) return;
    if (currentVerts.length === 0) return;
    const p = pageToRoom(e.clientX, e.clientY);
    setPreviewPoint(p);
  }

  function onMapMouseLeave() {
    setPreviewPoint(null);
  }

  // finish polygon (close) — require >=3 vertices
  function finishPolygon() {
    if (currentVerts.length < 3) return;
    const newZone = { id: Date.now(), points: currentVerts.slice() };
    persistAndRename([...zones, newZone]);
    setCurrentVerts([]);
    setPreviewPoint(null);
    setDrawMode(false);
  }

  function undoVertex() {
    setCurrentVerts((v) => v.slice(0, -1));
  }

  function clearZones() {
    persistAndRename([]);
  }

  function exportSave() {
    try {
      localStorage.setItem(`zones_floorplan_${planId}`, JSON.stringify(zones));
      alert("Zones saved");
    } catch {
      alert("Save failed");
    }
  }

  function deleteZone(id) {
    persistAndRename(zones.filter((z) => z.id !== id));
  }

  // convert point in room coords to percent coordinates for SVG (0..100)
  function pointToPercent(p) {
    const xPct = (p.x / Math.max(1, roomWidth)) * 100;
    const yPct = 100 - (p.y / Math.max(1, roomDepth)) * 100; // flip Y for SVG (top=0)
    return { xPct, yPct };
  }

  function polygonPointsAttr(points) {
    return points
      .map((p) => {
        const { xPct, yPct } = pointToPercent(p);
        return `${xPct},${yPct}`;
      })
      .join(" ");
  }

  function centroidOf(points) {
    // simple centroid of vertices (not necessarily geometric centroid, ok for label)
    const n = points.length;
    const sx = points.reduce((s, p) => s + p.x, 0) / n;
    const sy = points.reduce((s, p) => s + p.y, 0) / n;
    return { x: sx, y: sy };
  }

  function handleSelect(e) {
    const id = e.target.value;
    const fp = floorplans.find((f) => String(f.id) === String(id));
    setSelectedFloorplan(fp || null);
  }

  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Zone Configuration</h1>
        <p className="subtitle">Draw polygons on the map and press "Save Zone Configuration"</p>
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
            <div style={{ width: "90vw", maxWidth: 900, margin: "0 auto" }}>
              {/* toolbar above the map */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8, justifyContent: "flex-start" }}>
                <button className="page__control" onClick={() => setDrawMode((d) => !d)}>
                  {drawMode ? "Exit draw" : "Draw polygon"}
                </button>
                <button className="page__control" onClick={undoVertex} disabled={!drawMode || currentVerts.length === 0}>
                  Undo vertex
                </button>
                <button className="page__control" onClick={finishPolygon} disabled={!drawMode || currentVerts.length < 3}>
                  Finish polygon
                </button>
                <button className="page__control" onClick={clearZones} style={{ background: "#ef4444", color: "white" }}>
                  Clear zones
                </button>
              </div>

              {/* proportional container */}
              <div
                ref={containerRef}
                style={{
                  position: "relative",
                  width: "100%",
                  paddingBottom: `${(roomDepth / Math.max(1, roomWidth)) * 100}%`,
                  border: "2px solid var(--color-border)",
                  borderRadius: 12,
                  background: "var(--color-surface)",
                  touchAction: "none",
                }}
                onClick={onMapClick}
                onMouseMove={onMapMouseMove}
                onMouseLeave={onMapMouseLeave}
                onTouchStart={(e) => {
                  // map touch to click for adding vertices
                  if (!drawMode) return;
                  const t = e.touches?.[0];
                  if (t) {
                    onMapClick({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => {} });
                  }
                }}
              >
                {/* SVG overlay for polygons and preview */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  {/* existing zones */}
                  {zones.map((z, i) => {
                    const pts = polygonPointsAttr(z.points);
                    const { border, bg } = zoneColor(i);
                    const c = centroidOf(z.points);
                    const cPct = pointToPercent(c);
                    return (
                      <g key={z.id}>
                        <polygon points={pts} fill={bg} stroke={border} strokeWidth="0.8" />
                        <text x={cPct.xPct} y={cPct.yPct} fontSize="6" textAnchor="middle" fill={border} style={{ pointerEvents: "none", fontWeight: 600 }}>
                          {z.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* current polygon (filled) */}
                  {currentVerts.length > 0 && (
                    <>
                      <polygon
                        points={
                          polygonPointsAttr(currentVerts) + (previewPoint ? " " + `${pointToPercent(previewPoint).xPct},${pointToPercent(previewPoint).yPct}` : "")
                        }
                        fill="rgba(37,99,235,0.06)"
                        stroke="rgba(37,99,235,0.6)"
                        strokeWidth="0.6"
                      />
                      {/* draw small circles for vertices */}
                      {currentVerts.map((p, idx) => {
                        const { xPct, yPct } = pointToPercent(p);
                        return <circle key={idx} cx={xPct} cy={yPct} r="1.2" fill="white" stroke="rgba(37,99,235,0.9)" strokeWidth="0.6" />;
                      })}
                      {previewPoint && <circle cx={pointToPercent(previewPoint).xPct} cy={pointToPercent(previewPoint).yPct} r="1.0" fill="rgba(37,99,235,0.9)" />}
                    </>
                  )}
                </svg>
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
                            {z.points.length} points
                          </div>
                        </div>
                      </div>
                      <button onClick={() => deleteZone(z.id)} style={{ background: "#ff4d4d", color: "white", border: "none", padding: "6px 8px", borderRadius: 6 }}>
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