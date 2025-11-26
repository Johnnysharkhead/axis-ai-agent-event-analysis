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
      if (!res.ok) {
        console.warn("floorplan endpoint returned", res.status);
        setFloorplans([]);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data) { setFloorplans([]); return; }
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.floorplans)) list = data.floorplans;
      else if (Array.isArray(data.results)) list = data.results;
      else if (data.floorplan) list = [data.floorplan];
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
  const [currentVerts, setCurrentVerts] = useState([]);
  const [previewPoint, setPreviewPoint] = useState(null);
  const [snapTarget, setSnapTarget] = useState(null);
  const containerRef = useRef(null);

  // Modal / pending polygon state for naming and inline-editing
  const [showNameModal, setShowNameModal] = useState(false);
  const [modalName, setModalName] = useState("");
  const [pendingPolygon, setPendingPolygon] = useState(null);
  const [modalPos, setModalPos] = useState(null); // { xPct, yPct } position for modal over the zone

  useEffect(() => {
    async function loadZones() {
      if (!selectedFloorplan || !selectedFloorplan.id) { setZones([]); return; }
      try {
        const res = await fetch(`${API_BASE}/floorplan/${planId}/zones`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.zones || []);
          // normalize backend shape to the frontend shape expected by this component
          const normalized = list.map(z => ({
            id: z.id,
            name: z.name || "",
            // backend serialize uses "points" for coordinates; accept both to be safe
            points: z.points || z.coordinates || [],
            // ensure bbox is an array (backend uses float8[])
            bbox: Array.isArray(z.bbox) ? z.bbox : (z.bbox ? JSON.parse(z.bbox) : null),
            centroid: z.centroid || null
          }));
          setZones(normalized);
          return;
        }
      } catch (err) {
        // ignore and fallback
      }
      // fallback to localStorage
      try {
        const raw = localStorage.getItem(`zones_floorplan_${planId}`);
        setZones(raw ? JSON.parse(raw) : []);
      } catch {
        setZones([]);
      }
    }
    loadZones();
  }, [planId, selectedFloorplan]);

  function persistAndRename(next) {
    // maintain local UI state and computed meta; actual persistence to DB happens on "Save Zone Configuration"
    const renamed = (next || []).map((z,i)=> {
      const points = z.points || [];
      const meta = computeMeta(points);
      const name = (z.name && String(z.name).trim()) ? z.name.trim() : indexToLetters(i);
      return { id: z.id ?? Date.now() + i, points, name, bbox: meta.bbox, centroid: meta.centroid };
    });
    setZones(renamed);
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
    // while naming a zone, ignore clicks on the map (prevent continuing draw)
    if (showNameModal) return;
    if (!drawMode) return;
    const snap = getSnapTargetForClient(e.clientX, e.clientY);
    const p = snap ? { x: snap.x, y: snap.y } : pageToRoom(e.clientX, e.clientY);
    setCurrentVerts(v => [...v, p]);
    setPreviewPoint(null);
  }

  function onMapMouseMove(e) {
    const snap = drawMode ? getSnapTargetForClient(e.clientX, e.clientY) : null; 
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
    if (!selectedFloorplan || !selectedFloorplan.id) {
      alert("Please select a floorplan before finishing a polygon.");
      return;
    }
    // show modal to give the new zone a name anchored over the polygon centroid
    const pending = currentVerts.slice();
    setPendingPolygon(pending);
    setModalName("");
    setShowNameModal(true);
    setDrawMode(false); // prevent further drawing while naming
    const centroid = centroidOf(pending);
    let pos = pointToPercent(centroid);
    
    // Clamp modal position to prevent exceeding container edges
    const containerRect = containerRef.current.getBoundingClientRect();
    const modalWidth = 400; // approximate modal width (minWidth 320, maxWidth 420)
    const modalHeight = 200; // approximate modal height
    const halfWidthPct = (modalWidth / 2 / containerRect.width) * 100;
    const halfHeightPct = (modalHeight / 2 / containerRect.height) * 100;
    
    // Clamp horizontal position to keep modal within left/right bounds
    pos.xPct = Math.max(halfWidthPct, Math.min(100 - halfWidthPct, pos.xPct));
    
    // Clamp vertical position to keep modal within top/bottom bounds (though it's positioned above)
    pos.yPct = Math.max(halfHeightPct * 1.2, Math.min(100 - halfHeightPct, pos.yPct));
    
    setModalPos(pos);
  }
  function undoVertex() { setCurrentVerts(v => v.slice(0,-1)); }
  function clearZones() {
    if (!selectedFloorplan || !selectedFloorplan.id) {
      alert("Please select a floorplan before clearing zones.");
      return;
    }
    persistAndRename([]);
  }
  // Save zones to backend (replace zones for the floorplan). Fallback: persist to localStorage if backend fails.
  async function exportSave() {
    if (!selectedFloorplan || !selectedFloorplan.id) {
      alert("Please select a floorplan before saving zones.");
      return;
    }
    const payload = { zones: zones.map(z => ({ name: z.name, points: z.points })) };
    console.debug("Saving zones payload:", payload);
    try {
      const res = await fetch(`${API_BASE}/floorplan/${planId}/zones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.error("Save failed (server):", res.status, body);
        alert(`Save failed: ${body.error || JSON.stringify(body)}`);
        return;
      }
      // If server returns an error object inside 200, treat as failure
      if (body && body.error) {
        console.error("Server returned error:", body);
        alert(`Save failed: ${body.error} ${body.message || ""}`);
        return;
      }
      const updated = Array.isArray(body) ? body : (body.zones || []);
      if (updated && updated.length) {
        setZones(updated.map(z => ({
          id: z.id,
          name: z.name || "",
          points: z.points || z.coordinates || [],
          bbox: Array.isArray(z.bbox) ? z.bbox : (z.bbox ? JSON.parse(z.bbox) : null),
          centroid: z.centroid || null
        })));
        alert("Zones saved to database");
        return;
      }
      // success but empty response
      alert("Zones saved to database (no zones returned)");
    } catch (err) {
      console.warn("Failed to save zones to backend, falling back to localStorage:", err);
      try {
        localStorage.setItem(`zones_floorplan_${planId}`, JSON.stringify(zones));
        alert("Zones saved locally (backend unavailable)");
      } catch {
        alert("Save failed");
      }
    }
  }
  async function deleteZone(id) {
    // remove locally first for snappy UI
    const next = zones.filter(z => z.id !== id);
    persistAndRename(next);
    // try backend delete if id looks like server id (numeric)
    if (!id || String(id).startsWith("temp")) return;
    try {
      const res = await fetch(`${API_BASE}/zones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Status ${res.status}`);
    } catch (err) {
      console.warn("Failed to delete zone on backend:", err);
      // optionally keep local state — user can press Save to sync replacement
    }
  }

  // save modal name (create zone)
  function saveModalName() {
    if (!pendingPolygon) { cancelModal(); return; }
    const finalName = modalName && String(modalName).trim() ? modalName.trim() : `Zone ${zones.length + 1}`;
    const newZone = { id: Date.now(), points: pendingPolygon, name: finalName };
    persistAndRename([...zones, newZone]);
    setPendingPolygon(null);
    setShowNameModal(false);
    setModalPos(null);
    setModalName("");
    setCurrentVerts([]); setPreviewPoint(null); setDrawMode(false); setSnapTarget(null);
  }
  function cancelModal() {
    setPendingPolygon(null);
    setShowNameModal(false);
    setModalPos(null);
    setModalName("");
  }

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
              ? `${roomWidth}×${roomDepth} m - Floorplan Loaded` 
              : "No floorplan selected — choose one from the list on the left"}
          </p>

          <div style={{ marginTop:12 }}>
            <div style={{ width:"90vw", maxWidth:900, margin:"0 auto" }}>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <button className="page__control" onClick={() => { setDrawMode(d => !d); setCurrentVerts([]); setPreviewPoint(null); setSnapTarget(null); }} disabled={!selectedFloorplan}>
                  {drawMode ? "Exit draw" : "Draw polygon"}
                </button>
                <button className="page__control" onClick={undoVertex} disabled={!drawMode || currentVerts.length===0}>Undo vertex</button>
                <button className="page__control" onClick={finishPolygon} disabled={!selectedFloorplan || !drawMode || currentVerts.length<3}>Finish polygon</button>
                <button className="page__control" onClick={clearZones} style={{ background:"#ef4444", color:"white" }} disabled={!selectedFloorplan || zones.length===0}>Clear zones</button>
              </div>

              <div
                ref={containerRef}
                style={{ position:"relative", width:"100%", paddingBottom:`${(roomDepth / Math.max(1, roomWidth)) * 100}%`, border:"2px solid var(--color-border)", borderRadius:12, background:"var(--color-surface)", touchAction:"none" }}
                onClick={onMapClick}
                onMouseMove={onMapMouseMove}
                onMouseLeave={onMapMouseLeave}
                onTouchStart={(e)=> {
                  const t = e.touches?.[0]; if (!t) return;
                  if (drawMode) onMapClick({ clientX: t.clientX, clientY: t.clientY });
                }}
              >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
                  {zones.map((z,i) => {
                    const pts = polygonPointsAttr(z.points || []);
                    const { border, bg } = zoneColor(i);
                    const c = z.centroid || centroidOf(z.points || []);
                    const cPct = pointToPercent ? pointToPercent(c) : { xPct:50, yPct:50 };
                    return (
                      <g key={z.id}>
                        <polygon points={pts} fill={bg} stroke={border} strokeWidth="1.2" />
                        {/* outlined label: stroke text behind colored text for readability */}
                        <text x={cPct.xPct} y={cPct.yPct + 1.2} fontSize="6.2" textAnchor="middle" fill="#fff" stroke="#fff" strokeWidth="1.6" style={{ paintOrder:"stroke", pointerEvents:"none", fontWeight:700 }}>
                          {z.name}
                        </text>
                        <text x={cPct.xPct} y={cPct.yPct + 1.2} fontSize="6.2" textAnchor="middle" fill={border} style={{ pointerEvents:"none", fontWeight:800 }}>
                          {z.name}
                        </text>
                      </g>
                    );
                  })}

                  {snapTarget && <circle cx={pointToPercent({ x: snapTarget.x, y: snapTarget.y }).xPct} cy={pointToPercent({ x: snapTarget.x, y: snapTarget.y }).yPct} r="1.4" fill="none" stroke="#f59e0b" strokeWidth="0.6" />}

                  {currentVerts.length > 0 && <>
                    <polygon points={polygonPointsAttr(currentVerts) + (previewPoint ? " " + `${pointToPercent(previewPoint).xPct},${pointToPercent(previewPoint).yPct}` : "")} fill="rgba(37,99,235,0.06)" stroke="rgba(37,99,235,0.6)" strokeWidth="0.6" />
                    {currentVerts.map((p,idx)=> { const { xPct,yPct } = pointToPercent(p); return <circle key={idx} cx={xPct} cy={yPct} r="1.2" fill="white" stroke="rgba(37,99,235,0.9)" strokeWidth="0.6" />; })}
                    {previewPoint && <circle cx={pointToPercent(previewPoint).xPct} cy={pointToPercent(previewPoint).yPct} r="1.0" fill="rgba(37,99,235,0.9)" />}
                  </>}
                </svg>

                {/* Name modal anchored over the polygon (and with backdrop) */}
                {showNameModal && modalPos && (
                  <>
                    <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.28)", zIndex:40 }} onClick={cancelModal} />
                    <div
                      role="dialog"
                      aria-modal="true"
                      style={{
                        position: "absolute",
                        left: `${modalPos.xPct}%`,
                        top: `${modalPos.yPct}%`,
                        transform: "translate(-50%, -120%)",
                        zIndex: 50,
                        minWidth: 320,
                        maxWidth: 420,
                        background: "white",
                        padding: 16,
                        borderRadius: 10,
                        boxShadow: "0 12px 30px rgba(2,6,23,0.32)",
                        border: "1px solid rgba(15,23,42,0.06)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>Name new zone</div>
                        <button onClick={cancelModal} style={{ background: "transparent", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
                      </div>
                      <div style={{ color: "var(--color-muted)", fontSize: 13, marginBottom: 10 }}>Enter a descriptive name for the zone.</div>
                      <input
                        autoFocus
                        value={modalName}
                        onChange={(e) => setModalName(e.target.value)}
                        placeholder="e.g. Front Desk"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          fontSize: 14,
                          borderRadius: 8,
                          border: "1px solid rgba(15,23,42,0.08)",
                          marginBottom: 12,
                          boxSizing: "border-box"
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="page__control" onClick={cancelModal}>Cancel</button>
                        <button className="page__control page__control--primary" onClick={saveModalName}>Save zone</button>
                      </div>
                    </div>
                  </>
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
                        {/* inline editable name */}
                        <input
                          value={z.name || ""}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setZones(prev => prev.map(z2 => z2.id === z.id ? { ...z2, name: newName } : z2));
                          }}
                          onBlur={() => persistAndRename(zones)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            width: 200,
                            padding: "2px 4px",
                          }}
                        />
                        <div style={{ fontSize:12, color:"var(--color-muted)" }}>{(z.points||[]).length} points</div>
                      </div>
                    </div>
                    <button onClick={() => deleteZone(z.id)} style={{ background:"#ff4d4d", color:"white", border:"none", padding:"6px 8px", borderRadius:6 }} disabled={!selectedFloorplan}>Delete</button>
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