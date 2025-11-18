import React, { useEffect, useRef, useState } from "react";
import "../styles/pages.css";

function indexToLetters(idx) {
  let n = idx + 1, s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function zoneColor(i) {
  const h = (i * 57) % 360;
  return { border: `hsl(${h} 75% 35%)`, bg: `hsl(${h} 75% 50% / 0.12)` };
}

function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + Number.EPSILON) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function computeMeta(points) {
  if (!points || points.length === 0) return { bbox: [0,0,0,0], centroid: {x:0,y:0} };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, sx = 0, sy = 0;
  points.forEach(p => { minX = Math.min(minX,p.x); minY = Math.min(minY,p.y); maxX = Math.max(maxX,p.x); maxY = Math.max(maxY,p.y); sx += p.x; sy += p.y; });
  return { bbox: [minX,minY,maxX,maxY], centroid: { x: sx/points.length, y: sy/points.length } };
}

export default function ZoneConfiguration() {
  // API base (fall back to localhost backend used by other pages)
  const API_BASE = window.__API_URL__ || "http://localhost:5001";

  // load list of floorplans from backend
  async function loadFloorplans() {
    try {
      const res = await fetch(`${API_BASE}/floorplan`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const list = data?.floorplans || data?.floorplans?.length ? data.floorplans : (Array.isArray(data) ? data : []);
      setFloorplans(list);
      if (!selectedFloorplan && list.length) setSelectedFloorplan(list[0]);
    } catch (err) {
      console.warn("Failed to load floorplans", err);
      setFloorplans([]);
    }
  }
  useEffect(() => { loadFloorplans(); }, []);

  const [floorplans, setFloorplans] = useState([]);
  const [selectedFloorplan, setSelectedFloorplan] = useState(null);
  const roomWidth = selectedFloorplan?.width || 10;
  const roomDepth = selectedFloorplan?.depth || 10;
  const planId = selectedFloorplan?.id ?? "default";

  const [zones, setZones] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [intrusionMode, setIntrusionMode] = useState(false);
  const [currentVerts, setCurrentVerts] = useState([]);
  const [previewPoint, setPreviewPoint] = useState(null);
  const [snapTarget, setSnapTarget] = useState(null);
  const [intrusionResult, setIntrusionResult] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`zones_floorplan_${planId}`);
      setZones(raw ? JSON.parse(raw) : []);
    } catch { setZones([]); }
  }, [planId]);

  function persistAndRename(next) {
    const renamed = (next || []).map((z,i)=> {
      const points = z.points || [];
      const meta = computeMeta(points);
      return { id: z.id ?? Date.now() + i, points, name: indexToLetters(i), bbox: meta.bbox, centroid: meta.centroid };
    });
    setZones(renamed);
    try { localStorage.setItem(`zones_floorplan_${planId}`, JSON.stringify(renamed)); } catch {}
  }

  function pageToRoom(clientX, clientY) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x:0,y:0 };
    const px = clientX - rect.left, py = clientY - rect.top;
    const x = Math.max(0, Math.min(roomWidth, (px / rect.width) * roomWidth));
    const y = Math.max(0, Math.min(roomDepth, roomDepth - (py / rect.height) * roomDepth));
    return { x, y };
  }

  function roomToPixel(p, rect) {
    return { x: (p.x / Math.max(1, roomWidth)) * rect.width, y: rect.height - (p.y / Math.max(1, roomDepth)) * rect.height };
  }
  function pixelToRoom(px, py, rect) {
    return { x: (px / rect.width) * roomWidth, y: roomDepth - (py / rect.height) * roomDepth };
  }

  function getSnapTargetForClient(clientX, clientY) {
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return null;
    const mx = clientX - rect.left, my = clientY - rect.top; const threshold = 10;
    let best = null;
    const consider = (px,py,rx,ry,type,meta={}) => {
      const d = Math.hypot(mx-px,my-py);
      if (d <= threshold && (best === null || d < best.d)) best = { type, x: rx, y: ry, px, py, d, meta };
    };
    zones.forEach(z=> (z.points||[]).forEach((p,idx)=> consider(...Object.values(roomToPixel(p, rect)), p.x, p.y, "vertex", { zoneId: z.id, vertexIndex: idx })));
    zones.forEach(z=> {
      const pts = z.points || [];
      for (let i=0;i<pts.length;i++) {
        const a = roomToPixel(pts[i],rect), b = roomToPixel(pts[(i+1)%pts.length],rect);
        const vx = b.x - a.x, vy = b.y - a.y, len2 = vx*vx+vy*vy; if (!len2) continue;
        const t = Math.max(0, Math.min(1, ((mx-a.x)*vx + (my-a.y)*vy) / len2));
        const projx = a.x + t*vx, projy = a.y + t*vy;
        const r = pixelToRoom(projx, projy, rect);
        consider(projx, projy, r.x, r.y, "edge", { zoneId: z.id, segIndex: i });
      }
    });
    const roomCorners = [{x:0,y:0},{x:roomWidth,y:0},{x:roomWidth,y:roomDepth},{x:0,y:roomDepth}];
    for (let i=0;i<4;i++) {
      const a = roomCorners[i], b = roomCorners[(i+1)%4];
      const ap = roomToPixel(a,rect), bp = roomToPixel(b,rect);
      const vx = bp.x - ap.x, vy = bp.y - ap.y, len2 = vx*vx+vy*vy; if (!len2) continue;
      const t = Math.max(0, Math.min(1, ((mx-ap.x)*vx + (my-ap.y)*vy) / len2));
      const projx = ap.x + t*vx, projy = ap.y + t*vy;
      const r = pixelToRoom(projx, projy, rect);
      consider(projx, projy, r.x, r.y, "room-edge", { edgeIndex: i });
    }
    return best;
  }

  function onMapClick(e) {
    if (intrusionMode) {
      const p = pageToRoom(e.clientX, e.clientY);
      const hit = zones.find(z => {
        if (!z.bbox) return false;
        const [minX,minY,maxX,maxY] = z.bbox;
        if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) return false;
        return pointInPolygon(p, z.points || []);
      });
      setIntrusionResult({ point: p, zoneName: hit ? hit.name : null });
      return;
    }
    if (!drawMode) return;
    const snap = getSnapTargetForClient(e.clientX, e.clientY);
    const p = snap ? { x: snap.x, y: snap.y } : pageToRoom(e.clientX, e.clientY);
    setCurrentVerts(v => [...v, p]);
    setPreviewPoint(null);
  }

  function onMapMouseMove(e) {
    const snap = getSnapTargetForClient(e.clientX, e.clientY);
    setSnapTarget(snap);
    if (!drawMode || currentVerts.length === 0) return;
    const p = snap ? { x: snap.x, y: snap.y } : pageToRoom(e.clientX, e.clientY);
    setPreviewPoint(p);
  }
  function onMapMouseLeave() { setPreviewPoint(null); setSnapTarget(null); }

  function finishPolygon() {
    if (currentVerts.length < 3) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const firstPx = roomToPixel(currentVerts[0], rect);
      const lastPx = roomToPixel(currentVerts[currentVerts.length - 1], rect);
      if (Math.hypot(firstPx.x-lastPx.x, firstPx.y-lastPx.y) < 10) currentVerts[currentVerts.length - 1] = { ...currentVerts[0] };
    }
    persistAndRename([...zones, { id: Date.now(), points: currentVerts.slice() }]);
    setCurrentVerts([]); setPreviewPoint(null); setDrawMode(false); setSnapTarget(null);
  }
  function undoVertex() { setCurrentVerts(v => v.slice(0,-1)); }
  function clearZones() { persistAndRename([]); }
  function exportSave() { try { localStorage.setItem(`zones_floorplan_${planId}`, JSON.stringify(zones)); alert("Zones saved"); } catch { alert("Save failed"); } }
  function deleteZone(id) { persistAndRename(zones.filter(z => z.id !== id)); }

  function pointToPercent(p) { const xPct = (p.x / Math.max(1, roomWidth)) * 100; const yPct = 100 - (p.y / Math.max(1, roomDepth)) * 100; return { xPct, yPct }; }
  function polygonPointsAttr(points) { return (points || []).map(p => { const {xPct,yPct}=pointToPercent(p); return `${xPct},${yPct}`; }).join(" "); }
  function centroidOf(points) { const n = points.length; const sx = points.reduce((s,p)=>s+p.x,0)/n; const sy = points.reduce((s,p)=>s+p.y,0)/n; return {x:sx,y:sy}; }

  async function handleSelect(e) {
    const id = e.target.value;
    const fp = floorplans.find(f => String(f.id) === String(id));
    if (fp) { setSelectedFloorplan(fp); return; }
    // fetch single floorplan as fallback
    try {
      const res = await fetch(`${API_BASE}/floorplan/${id}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const single = data?.floorplan || data;
      if (single) {
        setFloorplans(prev => {
          if (prev.find(p => String(p.id) === String(single.id))) return prev;
          return [...prev, single];
        });
        setSelectedFloorplan(single);
      } else {
        setSelectedFloorplan(null);
      }
    } catch (err) {
      console.warn("Failed to fetch floorplan", err);
      setSelectedFloorplan(null);
    }
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
            <select value={selectedFloorplan?.id || ""} onChange={handleSelect} style={{ width:"100%", padding:"0.6rem", borderRadius:8 }}>
              <option value="">{floorplans.length ? "-- Select a Floorplan --" : "Loading floorplans..."}</option>
              {floorplans.map(fp => <option key={fp.id} value={fp.id}>{fp.name || `Floorplan ${fp.id}`} — {fp.width}×{fp.depth}m</option>)}
            </select>
            <div style={{ marginTop:8, fontSize:13, color:"var(--color-muted)" }}>{floorplans.length} floorplans</div>
          </div>

          <div className="page__section">
            <h3 className="page__section-title">Zone Configuration</h3>
            <div style={{ marginTop:12 }}>
              <button className="page__control" onClick={exportSave} style={{ width:"100%" }}>Save Zone Configuration</button>
            </div>
          </div>
        </aside>

        <div className="page__section" style={{ padding:20 }}>
          <h3 className="page__section-title">Map</h3>
          <p className="page__section-subtitle">
            {selectedFloorplan
              ? `${roomWidth}×${roomDepth} m — map fits viewport proportionally`
              : "No floorplan selected — choose one from the list on the left"}
          </p>

          <div style={{ marginTop:12 }}>
            <div style={{ width:"90vw", maxWidth:900, margin:"0 auto" }}>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <button className="page__control" onClick={() => { setIntrusionMode(false); setDrawMode(d => !d); setCurrentVerts([]); setPreviewPoint(null); setSnapTarget(null); }}>
                  {drawMode ? "Exit draw" : "Draw polygon"}
                </button>
                <button className="page__control" onClick={() => { setDrawMode(false); setIntrusionMode(s => !s); setCurrentVerts([]); setPreviewPoint(null); setSnapTarget(null); setIntrusionResult(null); }} style={intrusionMode ? { background:"#fde68a" } : {}}>
                  {intrusionMode ? "Exit intrusion" : "Intrusion test"}
                </button>
                <button className="page__control" onClick={undoVertex} disabled={!drawMode || currentVerts.length===0}>Undo vertex</button>
                <button className="page__control" onClick={finishPolygon} disabled={!drawMode || currentVerts.length<3}>Finish polygon</button>
                <button className="page__control" onClick={clearZones} style={{ background:"#ef4444", color:"white" }}>Clear zones</button>
              </div>

              <div
                ref={containerRef}
                style={{ position:"relative", width:"100%", paddingBottom:`${(roomDepth / Math.max(1, roomWidth)) * 100}%`, border:"2px solid var(--color-border)", borderRadius:12, background:"var(--color-surface)", touchAction:"none" }}
                onClick={onMapClick}
                onMouseMove={onMapMouseMove}
                onMouseLeave={onMapMouseLeave}
                onTouchStart={(e)=> {
                  const t = e.touches?.[0]; if (!t) return;
                  if (intrusionMode) onMapClick({ clientX: t.clientX, clientY: t.clientY }); else if (drawMode) onMapClick({ clientX: t.clientX, clientY: t.clientY });
                }}
              >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
                  {zones.map((z,i) => {
                    const pts = polygonPointsAttr(z.points || []);
                    const { border, bg } = zoneColor(i);
                    const c = z.centroid || centroidOf(z.points || []);
                    const cPct = pointToPercent ? pointToPercent(c) : { xPct:50, yPct:50 };
                    return <g key={z.id}><polygon points={pts} fill={bg} stroke={border} strokeWidth="0.8" /><text x={cPct.xPct} y={cPct.yPct} fontSize="6" textAnchor="middle" fill={border} style={{ pointerEvents:"none", fontWeight:600 }}>{z.name}</text></g>;
                  })}

                  {snapTarget && <circle cx={pointToPercent({ x: snapTarget.x, y: snapTarget.y }).xPct} cy={pointToPercent({ x: snapTarget.x, y: snapTarget.y }).yPct} r="1.4" fill="none" stroke="#f59e0b" strokeWidth="0.6" />}

                  {currentVerts.length > 0 && <>
                    <polygon points={polygonPointsAttr(currentVerts) + (previewPoint ? " " + `${pointToPercent(previewPoint).xPct},${pointToPercent(previewPoint).yPct}` : "")} fill="rgba(37,99,235,0.06)" stroke="rgba(37,99,235,0.6)" strokeWidth="0.6" />
                    {currentVerts.map((p,idx)=> { const { xPct,yPct } = pointToPercent(p); return <circle key={idx} cx={xPct} cy={yPct} r="1.2" fill="white" stroke="rgba(37,99,235,0.9)" strokeWidth="0.6" />; })}
                    {previewPoint && <circle cx={pointToPercent(previewPoint).xPct} cy={pointToPercent(previewPoint).yPct} r="1.0" fill="rgba(37,99,235,0.9)" />}
                  </>}
                </svg>

                {intrusionResult && (
                  <div style={{ position:"absolute", right:10, top:10, background:"white", border:"1px solid rgba(0,0,0,0.12)", padding:10, borderRadius:6, boxShadow:"0 6px 18px rgba(0,0,0,0.08)" }}>
                    <div style={{ fontWeight:700, marginBottom:6 }}>Intrusion test</div>
                    {intrusionResult.zoneName ? <div>Point inside zone: <strong>{intrusionResult.zoneName}</strong></div> : <div>No zone at point</div>}
                    <div style={{ marginTop:8, fontSize:12, color:"var(--color-muted)" }}>{intrusionResult.point.x.toFixed(2)}m, {intrusionResult.point.y.toFixed(2)}m</div>
                    <div style={{ marginTop:8, display:"flex", gap:8 }}><button className="page__control" onClick={() => setIntrusionResult(null)}>Close</button></div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop:12 }}>
              {zones.length === 0 ? <p style={{ color:"var(--color-muted)" }}>No zones defined</p> : zones.map((z,i) => {
                const { border } = zoneColor(i);
                return (
                  <div key={z.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:8, background:"var(--color-surface)", borderRadius:6, marginBottom:8 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <div style={{ width:14, height:14, borderRadius:3, border:`2px solid ${border}` }} />
                      <div>
                        <strong>{z.name}</strong>
                        <div style={{ fontSize:12, color:"var(--color-muted)" }}>{(z.points||[]).length} points</div>
                      </div>
                    </div>
                    <button onClick={() => deleteZone(z.id)} style={{ background:"#ff4d4d", color:"white", border:"none", padding:"6px 8px", borderRadius:6 }}>Delete</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}