import React, { useEffect, useState } from "react";
import "../styles/pages.css";
import "../styles/scheduleAlarms.css";

// pure helpers (safe at module level)
function zoneColor(i) {
  const h = (i * 57) % 360;
  const border = `hsl(${h} 75% 35%)`;
  const bg = `hsl(${h} 75% 50% / 0.12)`;
  return { border, bg };
}
const DAYS_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
function timeToMinutes(t) {
  if (!t) return 0;
  const [hh, mm] = String(t).split(":");
  return Number(hh || 0) * 60 + Number(mm || 0);
}
function localDateTimeString(date, hour = 22, minute = 0) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${mo}-${d}T${pad(hour)}:${pad(minute)}`;
}
function formatDateTime(s) {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleString();
}
function formatDateTimeDuration(a, b) {
  try {
    const secs = Math.max(0, (new Date(b) - new Date(a)) / 1000);
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hrs}h ${mins}m`;
  } catch {
    return "";
  }
}
function formatDuration(start, end, spansNextDay, multiplier = 1) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  let diff = e - s;
  if (diff <= 0 && spansNextDay) diff += 24 * 60;
  if (diff < 0) diff = Math.abs(diff);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m${multiplier !== 1 ? ` × ${multiplier}` : ""}`;
}

function ScheduleAlarms({ embedded = false }) {
  // API base (reuse same convention as other pages)
  const API_BASE = window.__API_URL__ || "http://localhost:5001";

  // --- component state (hooks must be inside component) ---
  const [zones, setZones] = useState([]);
  const [schedules, setSchedules] = useState({}); // { [zoneId]: [schedule,...] }
  const [floorplans, setFloorplans] = useState([]);
  const [selectedFloorplanId, setSelectedFloorplanId] = useState(null);
  const [selectedZone, setSelectedZone] = useState("");

  const [scheduleType, setScheduleType] = useState("recurring");
  const [days, setDays] = useState({ Mon:false,Tue:false,Wed:false,Thu:false,Fri:false,Sat:false,Sun:false });
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("07:00");
  const [spansNextDay, setSpansNextDay] = useState(true);
  const [alarmMode, setAlarmMode] = useState("daily");
  const [startDateTime, setStartDateTime] = useState(localDateTimeString(new Date(),22,0));
  const [endDateTime, setEndDateTime] = useState(localDateTimeString(new Date(Date.now()+24*3600*1000),7,0));

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictingAlarms, setConflictingAlarms] = useState([]);
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [replacementData, setReplacementData] = useState(null);
  const [showExpired, setShowExpired] = useState(false);

  // --- load floorplans on mount ---
  useEffect(() => {
    async function loadFloorplans() {
      const candidates = [
        `${API_BASE}/floorplan`,
        `${API_BASE}/floorplans`,
        `${API_BASE}/api/floorplan`,
        `${API_BASE}/api/floorplans`
      ];
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            // try next candidate
            continue;
          }
          // try parse JSON safely
          const data = await res.json().catch(() => null);
          if (!data) continue;
          // normalize common shapes: array or { floorplans: [...] } or { floorplan: {...} }
          let list = [];
          if (Array.isArray(data)) list = data;
          else if (Array.isArray(data.floorplans)) list = data.floorplans;
          else if (Array.isArray(data.results)) list = data.results;
          else if (data.floorplan) list = [data.floorplan];
          // basic validation: must contain id/name
          if (list.length && list.every(p => p && ("id" in p))) {
            setFloorplans(list);
            return;
          }
        } catch (err) {
          // try next candidate
          continue;
        }
      }
      // fallback empty
      console.warn("No floorplans found at known endpoints");
      setFloorplans([]);
    }
    loadFloorplans();
  }, [API_BASE]);

  // --- load zones when selected floorplan changes ---
  useEffect(() => {
    async function loadZones(fpId) {
      if (!fpId) { setZones([]); setSelectedZone(""); return; }
      try {
        const res = await fetch(`${API_BASE}/floorplan/${fpId}/zones`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.zones || []);
        const normalized = list.map(z => ({
          id: z.id,
          name: z.name || "",
          points: z.points || z.coordinates || [],
          bbox: Array.isArray(z.bbox) ? z.bbox : (z.bbox ? JSON.parse(z.bbox) : null),
          centroid: z.centroid || null
        }));
        setZones(normalized);
        // clear schedules cache for previous selection
        setSchedules(prev => {
          const next = { ...prev };
          // keep schedules only for zones in this floorplan (optional)
          const ids = new Set(normalized.map(z => String(z.id)));
          Object.keys(next).forEach(k => { if (!ids.has(String(k))) delete next[k]; });
          return next;
        });
        setSelectedZone("");
      } catch (err) {
        console.warn("Failed to load zones for floorplan", fpId, err);
        setZones([]);
      }
    }
    loadZones(selectedFloorplanId);
  }, [selectedFloorplanId, API_BASE]);

  function toggleDay(d) { setDays(prev => ({ ...prev, [d]: !prev[d] })); }
  function getZoneName(id) {
    if (!id) return "";
    const z = zones.find(z => String(z.id) === String(id));
    return z ? z.name : String(id);
  }
  // select handlers used by the Floorplan / Zone dropdowns
  function onSelectFloorplan(e) {
    const v = e.target.value;
    const id = v ? Number(v) : null;
    setSelectedFloorplanId(id);
    setSelectedZone("");
    setZones([]);
    // clear schedule cache when switching floorplan
    setSchedules({});
    setMessage("");
  }

  function onSelectZone(e) {
    const v = e.target.value;
    const id = v ? Number(v) : "";
    setSelectedZone(id);
    setMessage("");
  }
  function areAdjacentDays(arr) {
    if (!Array.isArray(arr) || arr.length < 2) return false;
    const idx = arr.map(d => DAYS_ORDER.indexOf(d)).sort((a,b)=>a-b);
    for (let i=1;i<idx.length;i++) if (idx[i] - idx[i-1] !== 1) return false;
    return true;
  }
  function getOvernightPairs(daysArr) {
    if (!Array.isArray(daysArr)) return [];
    // simple representation: pairs day -> nextDay
    return daysArr.map((d,i) => [d, daysArr[(i+1) % daysArr.length]]);
  }
  function isDuplicateAlarm(zoneId, newAlarm) {
    const list = schedules[zoneId] || [];
    return list.some(a => {
      if (a.type !== newAlarm.type) return false;
      if (a.type === "recurring") {
        return JSON.stringify(a.days || []) === JSON.stringify(newAlarm.days || []) &&
               a.start === newAlarm.start && a.end === newAlarm.end;
      } else {
        return a.startDateTime === newAlarm.startDateTime && a.endDateTime === newAlarm.endDateTime;
      }
    });
  }
  // lightweight conflict detection: returns empty conflicts/superseded by default
  function findConflicts(zoneId, newAlarm) { return { conflicts: [], superseded: [] }; }

  // load zones (existing) - unchanged
  // when a zone is selected, fetch schedules from backend
  useEffect(() => {
    async function fetchSchedulesForZone(zoneId) {
      if (!zoneId) return;
      try {
        const res = await fetch(`${API_BASE}/zones/${zoneId}/schedules`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        setSchedules(prev => ({ ...prev, [zoneId]: data.schedules || [] }));
      } catch (err) {
        console.warn("Failed to load schedules for zone", zoneId, err);
        setSchedules(prev => ({ ...prev, [zoneId]: prev[zoneId] || [] }));
      }
    }
    if (selectedZone) fetchSchedulesForZone(selectedZone);
  }, [selectedZone]);

  // Helper uses same getZoneName

  // modify addAlarm to POST to backend instead of localStorage
  async function addAlarm() {
    if (!selectedZone) {
      setMessage("Please select a zone first");
      setMessageType("error");
      return;
    }
    let newAlarm;
    if (scheduleType === "recurring") {
      const activeDays = Object.keys(days).filter(d => days[d]);
      if (!activeDays.length) { setMessage("Please select at least one day"); setMessageType("error"); return; }
      if (alarmMode === "continuous" && activeDays.length > 1 && !areAdjacentDays(activeDays)) {
        setMessage("Continuous alarms require adjacent days. Use Daily mode for non-adjacent days.");
        setMessageType("error");
        return;
      }
      newAlarm = {
        type: "recurring",
        days: activeDays,
        start: start,
        end: end,
        spansNextDay: spansNextDay,
        alarmMode: alarmMode,
        enabled: true
      };
    } else {
      if (!startDateTime || !endDateTime) { setMessage("Please set both start and end date/time."); setMessageType("error"); return; }
      newAlarm = {
        type: "one-time",
        startDateTime: startDateTime,
        endDateTime: endDateTime,
        enabled: true
      };
    }

    if (isDuplicateAlarm(selectedZone, newAlarm)) { setShowDuplicateModal(true); return; }
    const { conflicts, superseded } = findConflicts(selectedZone, newAlarm);
    if (conflicts.length > 0) { setConflictingAlarms(conflicts); setShowConflictModal(true); return; }
    if (superseded.length > 0) { setReplacementData({ newAlarm, superseded }); setShowReplacementModal(true); return; }

    try {
      const res = await fetch(`${API_BASE}/zones/${selectedZone}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAlarm)
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const created = await res.json();
      setSchedules(prev => ({ ...prev, [selectedZone]: [...(prev[selectedZone] || []), created] }));
      setMessage(`Alarm successfully added to Zone ${getZoneName(selectedZone)}`);
      setMessageType("success");
      resetForm();
    } catch (err) {
      console.error("Failed to create schedule", err);
      setMessage("Failed to save alarm to server");
      setMessageType("error");
    }
  }

  // removeRule -> delete on server
  async function removeRule(zone,id){
    try {
      const res = await fetch(`${API_BASE}/zones/${zone}/schedules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSchedules(prev => {
        const nextList = (prev[zone] || []).filter(r => r.id !== id);
        return { ...prev, [zone]: nextList };
      });
      setMessage(`Alarm removed from Zone ${getZoneName(zone)}`);
      setMessageType("info");
    } catch (err) {
      console.error("Failed to delete schedule", err);
      setMessage("Failed to remove alarm on server");
      setMessageType("error");
    }
  }

  // confirmReplacement -> create new and delete superseded on server
  async function confirmReplacement() {
    if (!replacementData) return;
    const { newAlarm, superseded } = replacementData;
    try {
      const res = await fetch(`${API_BASE}/zones/${selectedZone}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAlarm)
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const created = await res.json();
      await Promise.all(superseded.map(s => fetch(`${API_BASE}/zones/${selectedZone}/schedules/${s.id}`, { method: "DELETE" })));
      // refresh
      const r2 = await fetch(`${API_BASE}/zones/${selectedZone}/schedules`);
      const data = await (r2.ok ? r2.json() : Promise.resolve({ schedules: [] }));
      setSchedules(prev => ({ ...prev, [selectedZone]: data.schedules || [] }));
      setMessage(`Alarm added and ${superseded.length} existing alarm(s) replaced`);
      setMessageType("success");
      setShowReplacementModal(false); setReplacementData(null); resetForm();
    } catch (err) {
      console.error("Replacement failed", err);
      setMessage("Failed to replace alarms on server");
      setMessageType("error");
    }
  }

  function resetForm(){
    setDays({ Mon:false,Tue:false,Wed:false,Thu:false,Fri:false,Sat:false,Sun:false });
    setStart("22:00"); 
    setEnd("07:00");
    setAlarmMode("daily");
    // Reset one-time schedule to DST-safe local defaults: today 22:00 -> next day 07:00
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    setStartDateTime(localDateTimeString(today, 22, 0));
    setEndDateTime(localDateTimeString(tomorrow, 7, 0));
    setMessage("");
    setMessageType("info");
  }

  function selectAllDays() {
    setDays({ Mon:true,Tue:true,Wed:true,Thu:true,Fri:true,Sat:true,Sun:true });
  }

  function selectWeekdays() {
    setDays({ Mon:true,Tue:true,Wed:true,Thu:true,Fri:true,Sat:false,Sun:false });
  }

  function selectWeekend() {
    setDays({ Mon:false,Tue:false,Wed:false,Thu:false,Fri:false,Sat:true,Sun:true });
  }

  function sortAlarms(alarms) {
    return [...alarms].sort((a, b) => {
      // Sort by type first (recurring before one-time)
      if (a.type !== b.type) {
        return a.type === "recurring" ? -1 : 1;
      }
      // For recurring, sort by start time
      if (a.type === "recurring") {
        return timeToMinutes(a.start) - timeToMinutes(b.start);
      }
      // For one-time, sort by start date/time
      return new Date(a.startDateTime) - new Date(b.startDateTime);
    });
  }

  function getAlarmStatus(alarm) {
    if (alarm.type === "recurring") {
      return { active: true, label: "Active" };
    }
    const now = new Date();
    const end = new Date(alarm.endDateTime);
    if (end < now) {
      return { active: false, label: "Expired" };
    }
    const start = new Date(alarm.startDateTime);
    if (start > now) {
      return { active: true, label: "Scheduled" };
    }
    return { active: true, label: "Active Now" };
  }

  // Simple sketch map placeholder
  function SketchMap() {
    // Use selected floorplan dimensions so the map keeps the same proportions as the floorplan
    const fp = floorplans.find(fp => fp && String(fp.id) === String(selectedFloorplanId));
    const mapW = (fp && Number(fp.width)) ? Number(fp.width) : 10;   // meters (fallback)
    const mapH = (fp && Number(fp.depth)) ? Number(fp.depth) : 10;   // meters (fallback)

    // If no zones, render a simple white box with small black border at correct aspect ratio
    if (!zones || zones.length === 0) {
      // keep previous visual but use white background + very thin black border and square corners
      return (
        <div style={{ width:"100%", display:"flex", justifyContent:"center" }}>
          <svg width="100%" height="300" viewBox={`0 0 ${mapW} ${mapH}`} preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width={mapW} height={mapH} fill="#ffffff" stroke="#000" strokeWidth="0.18" />
          </svg>
        </div>
      );
    }

    // Render stored polygon zones scaled to floorplan (SVG coordinate system: y increases downward)
    return (
      <div style={{ width:"100%", display:"flex", justifyContent:"center" }}>
        <svg width="100%" height="300" viewBox={`0 0 ${mapW} ${mapH}`} preserveAspectRatio="xMidYMid meet">
          {/* white background with very thin black border and sharp corners */}
          <rect x="0" y="0" width={mapW} height={mapH} fill="#ffffff" stroke="#000" strokeWidth="0.18" />
          {zones.map((z, i) => {
            if (!z || !Array.isArray(z.points) || z.points.length === 0) return null;
            // convert points: keep native units (m) and flip Y to match SVG coords
            const pts = z.points.map(p => `${p.x},${(mapH - p.y)}`).join(" ");
            const { border, bg } = zoneColor(i);
            const cx = z.points.reduce((s,p)=>s + Number(p.x), 0) / z.points.length;
            const cy = z.points.reduce((s,p)=>s + Number(p.y), 0) / z.points.length;
            const svgCx = cx;
            const svgCy = mapH - cy;
            const isSelected = selectedZone !== "" && String(selectedZone) === String(z.id);
            const strokeColor = isSelected ? "#000" : border;
            // outlines: same narrow width whether selected (black) or not
            const strokeW = 0.12;
            // compute label font size and optional white background rect to "remove underlying" polygon under name when selected
            const fontSize = Math.min(1.2, mapH * 0.08);
            const name = z.name || "";
            // no background rect for label — only outline highlight when selected

            return (
              <g key={z.id || i}>
                <polygon
                  points={pts}
                  fill={bg}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <text
                  x={svgCx}
                  y={svgCy}
                  fontSize={fontSize}
                  textAnchor="middle"
                  fill={strokeColor}
                  style={{ fontWeight: 600, pointerEvents: "none" }}
                >
                  {name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const Inner = (
    <div className="page__section">
      {/* Duplicate alarm modal */}
      {showDuplicateModal && (
        <div className="schedule-modal" onClick={() => setShowDuplicateModal(false)}>
          <div className="schedule-modal__content" onClick={(e) => e.stopPropagation()}>
            <h3 className="schedule-modal__title">
              Duplicate Alarm Detected
            </h3>
            <p className="schedule-modal__text">
              An alarm with the same days and time schedule already exists for this zone. Please choose different days or times.
            </p>
            <button 
              className="page__control page__control--primary schedule-modal__button"
              onClick={() => setShowDuplicateModal(false)}
            >
              OK, Got It
            </button>
          </div>
        </div>
      )}

      {/* Conflict modal */}
      {showConflictModal && (
        <div className="schedule-modal" onClick={() => setShowConflictModal(false)}>
          <div className="schedule-modal__content schedule-modal__content--warning" onClick={(e) => e.stopPropagation()}>
            <h3 className="schedule-modal__title">
              ⚠️ Time Conflict Detected
            </h3>
            <p className="schedule-modal__text">
              There {conflictingAlarms.length === 1 ? 'is' : 'are'} already {conflictingAlarms.length} active alarm{conflictingAlarms.length > 1 ? 's' : ''} during this time period:
            </p>
            <div className="schedule-modal__conflicts">
              {conflictingAlarms.map(alarm => (
                <div key={alarm.id} className="schedule-modal__conflict-item">
                  {alarm.type === "recurring" ? (
                    <>
                      <strong>{alarm.days.join(", ")}</strong>
                      <span>{alarm.start} → {alarm.end}</span>
                      {alarm.spansNextDay && <span className="schedule-modal__badge">🌙 Overnight</span>}
                    </>
                  ) : (
                    <>
                      <strong>{formatDateTime(alarm.startDateTime)}</strong>
                      <span>→ {formatDateTime(alarm.endDateTime)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="schedule-modal__text schedule-modal__text--small">
              Please choose a different time or remove the conflicting alarm(s) first.
            </p>
            <button 
              className="page__control page__control--primary schedule-modal__button"
              onClick={() => {
                setShowConflictModal(false);
                setConflictingAlarms([]);
              }}
            >
              OK, I Understand
            </button>
          </div>
        </div>
      )}

      {/* Replacement confirmation modal */}
      {showReplacementModal && replacementData && (
        <div className="schedule-modal" onClick={() => {
          setShowReplacementModal(false);
          setReplacementData(null);
        }}>
          <div className="schedule-modal__content schedule-modal__content--confirm" onClick={(e) => e.stopPropagation()}>
            <h3 className="schedule-modal__title">
              🔄 Replace Existing Alarm?
            </h3>
            <p className="schedule-modal__text">
              Your new alarm will completely replace the following existing alarm{replacementData.superseded.length > 1 ? 's' : ''}:
            </p>
            <div className="schedule-modal__conflicts">
              {replacementData.superseded.map(alarm => (
                <div key={alarm.id} className="schedule-modal__conflict-item schedule-modal__conflict-item--replace">
                  {alarm.type === "recurring" ? (
                    <>
                      <strong>{alarm.days.join(", ")}</strong>
                      <span>{alarm.start} → {alarm.end}</span>
                      {alarm.spansNextDay && <span className="schedule-modal__badge">🌙 Overnight</span>}
                    </>
                  ) : (
                    <>
                      <strong>{formatDateTime(alarm.startDateTime)}</strong>
                      <span>→ {formatDateTime(alarm.endDateTime)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="schedule-modal__text schedule-modal__text--small">
              The existing alarm{replacementData.superseded.length > 1 ? 's' : ''} will be removed and your new alarm will be added.
            </p>
            <div className="schedule-modal__buttons">
              <button 
                className="page__control page__control--secondary schedule-modal__button"
                onClick={() => {
                  setShowReplacementModal(false);
                  setReplacementData(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="page__control page__control--primary schedule-modal__button"
                onClick={confirmReplacement}
              >
                Replace Alarm{replacementData.superseded.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="schedule-layout">
        {/* Left column - Form */}
        <div className="schedule-layout__form">
          <div className="schedule-alarms__zone-select">
            <label className="schedule-alarms__zone-label">
              Select Zone
            </label>
            {/* Floorplan selector — choose which floorplan's zones to load */}
            <div style={{ marginBottom: 8 }}>
              <select
                value={selectedFloorplanId ?? ""}
                onChange={onSelectFloorplan}
                className="schedule-alarms__zone-dropdown"
                style={{ width: "100%", marginBottom: 6 }}
              >
                <option value="">-- Select Floorplan --</option>
                {floorplans.map(fp => <option key={fp.id} value={fp.id}>{fp.name} — {fp.width}×{fp.depth}m</option>)}
              </select>
            </div>
 
            <select
              value={selectedZone ?? ""}
              onChange={onSelectZone}
              className="schedule-alarms__zone-dropdown"
            >
              <option value="">-- Select Zone --</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
           </div>
 
          <div className="schedule-form">
            <h3 className="schedule-form__title">
              New Scheduled Alarm
            </h3>

            {/* Schedule Type Toggle */}
            <div className="schedule-type-toggle">
              <div className="schedule-type-toggle__label">
                Schedule Type
              </div>
              <div className="schedule-type-toggle__buttons">
                <button
                  onClick={() => setScheduleType("recurring")}
                  className={`schedule-type-toggle__button ${scheduleType === "recurring" ? "schedule-type-toggle__button--active" : ""}`}
                >
                  🔄 Recurring
                </button>
                <button
                  onClick={() => setScheduleType("one-time")}
                  className={`schedule-type-toggle__button ${scheduleType === "one-time" ? "schedule-type-toggle__button--active" : ""}`}
                >
                  📅 One-Time
                </button>
              </div>
            </div>

            {/* Recurring Schedule Form */}
            {scheduleType === "recurring" && (
              <>
                {/* Day Selection */}
                <div className="day-selection">
                  <div className="day-selection__header">
                    <div className="day-selection__label">
                      Active Days
                    </div>
                    <div className="day-selection__presets">
                      <button
                        onClick={selectWeekdays}
                        className="page__control day-selection__preset-btn"
                      >
                        Weekdays
                      </button>
                      <button
                        onClick={selectWeekend}
                        className="page__control day-selection__preset-btn"
                      >
                        Weekend
                      </button>
                      <button
                        onClick={selectAllDays}
                        className="page__control day-selection__preset-btn"
                      >
                        All
                      </button>
                    </div>
                  </div>
                  <div className="day-selection__grid">
                    {Object.keys(days).map(d => (
                      <label 
                        key={d} 
                        className={`day-selection__day ${days[d] ? "day-selection__day--selected" : ""}`}
                      >
                        <input 
                          type="checkbox" 
                          checked={days[d]} 
                          onChange={() => toggleDay(d)}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Time Selection */}
                <div className="time-schedule">
                  <div className="time-schedule__label">
                    Time Schedule
                  </div>
                  <div className="time-schedule__inputs">
                    <div className="time-schedule__input-group">
                      <div className="time-schedule__input-label">
                        Start Time
                      </div>
                      <input 
                        type="time" 
                        value={start} 
                        onChange={e=>setStart(e.target.value)}
                        className="time-schedule__input"
                      />
                    </div>
                    <div className="time-schedule__arrow">
                      →
                    </div>
                    <div className="time-schedule__input-group">
                      <div className="time-schedule__input-label">
                        End Time
                      </div>
                      <input 
                        type="time" 
                        value={end} 
                        onChange={e=>setEnd(e.target.value)}
                        className="time-schedule__input"
                      />
                    </div>
                  </div>
                </div>

                {/* Alarm Mode Selection - Only show if multiple days selected */}
                {(() => {
                  const activeDays = Object.keys(days).filter(d => days[d]);
                  const isAdjacent = areAdjacentDays(activeDays);
                  const overnightPairs = getOvernightPairs(activeDays);
                  const overnightAlarmCount = spansNextDay ? overnightPairs.length : activeDays.length;
                  
                  if (activeDays.length > 1) {
                    return (
                      <div className="alarm-mode-selection">
                        <div className="alarm-mode-selection__label">
                          Alarm Pattern
                        </div>
                        <div className="alarm-mode-selection__options">
                          {isAdjacent && (
                            <label className={`alarm-mode-option ${alarmMode === "continuous" ? "alarm-mode-option--selected" : ""}`}>
                              <input
                                type="radio"
                                name="alarmMode"
                                value="continuous"
                                checked={alarmMode === "continuous"}
                                onChange={() => setAlarmMode("continuous")}
                              />
                              <div className="alarm-mode-option__content">
                                <div className="alarm-mode-option__icon">🔗</div>
                                <div className="alarm-mode-option__text">
                                  <div className="alarm-mode-option__title">Continuous</div>
                                  <div className="alarm-mode-option__desc">One alarm from {activeDays[0]} {start} to {activeDays[activeDays.length - 1]} {end}</div>
                                </div>
                              </div>
                            </label>
                          )}
                          <label className={`alarm-mode-option ${alarmMode === "daily" ? "alarm-mode-option--selected" : ""}`}>
                            <input
                              type="radio"
                              name="alarmMode"
                              value="daily"
                              checked={alarmMode === "daily"}
                              onChange={() => setAlarmMode("daily")}
                            />
                            <div className="alarm-mode-option__content">
                              <div className="alarm-mode-option__icon">🔄</div>
                              <div className="alarm-mode-option__text">
                                <div className="alarm-mode-option__title">Daily Repeat</div>
                                <div className="alarm-mode-option__desc">
                                  {spansNextDay ? (
                                    <>
                                      {overnightAlarmCount} overnight alarm{overnightAlarmCount !== 1 ? 's' : ''} 
                                      {overnightPairs.length > 0 && overnightPairs.length <= 4 && (
                                        <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.8 }}>
                                          {overnightPairs.map(p => `${p[0]}→${p[1]}`).join(', ')}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    `${activeDays.length} alarm${activeDays.length !== 1 ? 's' : ''}, ${start}–${end} each day`
                                  )}
                                </div>
                              </div>
                            </div>
                          </label>
                        </div>
                        {!isAdjacent && (
                          <div className="alarm-mode-selection__note">
                            ℹ️ Non-adjacent days can only use Daily Repeat mode
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Duration & Overnight Info */}
                {(() => {
                  const activeDays = Object.keys(days).filter(d => days[d]);
                  const isMultiDay = activeDays.length > 1;
                  const overnightPairs = getOvernightPairs(activeDays);
                  const overnightAlarmCount = overnightPairs.length;
                  
                  let displayIcon, displayTitle, durationText;
                  
                  if (isMultiDay && alarmMode === "continuous") {
                    displayIcon = '🔗';
                    displayTitle = 'Continuous Multi-Day Alarm';
                    durationText = `from ${activeDays[0]} ${start} to ${activeDays[activeDays.length - 1]} ${end}`;
                  } else if (isMultiDay && alarmMode === "daily") {
                    if (spansNextDay) {
                      displayIcon = '🌙';
                      displayTitle = `${overnightAlarmCount} Overnight Alarm${overnightAlarmCount !== 1 ? 's' : ''}`;
                      durationText = `${start}–${end} each night, continuing to next day`;
                    } else {
                      displayIcon = '🔄';
                      displayTitle = `${activeDays.length} Daily Alarms`;
                      durationText = `${start}–${end} on each selected day`;
                    }
                  } else {
                    displayIcon = spansNextDay ? '🌙' : '☀️';
                    displayTitle = spansNextDay ? 'Overnight Alarm' : 'Same-Day Alarm';
                    durationText = spansNextDay ? '(continues into next day)' : '';
                  }
                  
                  return (
                    <div className={`duration-info ${isMultiDay || spansNextDay ? "duration-info--overnight" : "duration-info--same-day"}`}>
                      <div className="duration-info__header">
                        <span className="duration-info__icon">{displayIcon}</span>
                        <strong className="duration-info__title">
                          {displayTitle}
                        </strong>
                      </div>
                      <div className="duration-info__text">
                        {isMultiDay && alarmMode === "continuous" ? (
                          <>Duration: <strong>{formatDuration(start, end, spansNextDay, activeDays.length)}</strong> {durationText}</>
                        ) : (
                          <>Duration per alarm: <strong>{formatDuration(start, end, spansNextDay, 1)}</strong> {durationText}</>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {/* One-Time Schedule Form */}
            {scheduleType === "one-time" && (
              <>
                <div className="datetime-schedule">
                  <div className="datetime-schedule__label">
                    Date & Time Range
                  </div>
                  <div className="datetime-schedule__inputs">
                    <div className="time-schedule__input-group">
                      <div className="time-schedule__input-label">
                        Start Date & Time
                      </div>
                      <input 
                        type="datetime-local" 
                        value={startDateTime} 
                        onChange={e=>setStartDateTime(e.target.value)}
                        className="time-schedule__input"
                      />
                    </div>
                    <div className="datetime-schedule__separator">
                      ↓
                    </div>
                    <div className="time-schedule__input-group">
                      <div className="time-schedule__input-label">
                        End Date & Time
                      </div>
                      <input 
                        type="datetime-local" 
                        value={endDateTime} 
                        onChange={e=>setEndDateTime(e.target.value)}
                        className="time-schedule__input"
                      />
                    </div>
                  </div>
                </div>

                {/* Duration Info for One-Time */}
                {startDateTime && endDateTime && new Date(endDateTime) > new Date(startDateTime) && (
                  <div className="duration-info duration-info--datetime">
                    <div className="duration-info__header">
                      <span className="duration-info__icon">⏱️</span>
                      <strong className="duration-info__title">
                        Specific Date/Time Alarm
                      </strong>
                    </div>
                    <div className="duration-info__text">
                      Duration: <strong>{formatDateTimeDuration(startDateTime, endDateTime)}</strong>
                    </div>
                    <div className="duration-info__details">
                      From: {formatDateTime(startDateTime)}
                    </div>
                    <div className="duration-info__details">
                      To: {formatDateTime(endDateTime)}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="form-actions">
              <button 
                className={`page__control page__control--primary form-actions__submit ${!selectedZone ? 'page__control--disabled' : ''}`}
                onClick={addAlarm}
                aria-disabled={!selectedZone}
              >
                Add Alarm in Zone
              </button>
              <button 
                className="page__control" 
                onClick={resetForm}
              >
                Reset
              </button>
            </div>
            {message && (
              <div className={`message-box message-box--${messageType}`}>
                <span>{messageType === 'success' ? '✓' : messageType === 'error' ? '⚠' : 'ℹ'}</span>
                <span>{message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Scheduled Alarms List */}
        <div className="alarm-list">
          <div className="alarm-list__header">
            <h3 className="alarm-list__title">
              Scheduled Alarms
            </h3>
            <div className="alarm-list__header-actions">
              {selectedZone && (schedules[selectedZone] || []).length > 0 && (
                <div className="alarm-list__counter">
                  Zone {getZoneName(selectedZone)} · {(schedules[selectedZone] || []).filter(a => showExpired || getAlarmStatus(a).active).length} alarm{(schedules[selectedZone] || []).filter(a => showExpired || getAlarmStatus(a).active).length !== 1 ? 's' : ''}
                </div>
              )}
              {selectedZone && (schedules[selectedZone] || []).some(a => !getAlarmStatus(a).active) && (
                <label className="alarm-list__filter">
                  <input
                    type="checkbox"
                    checked={showExpired}
                    onChange={(e) => setShowExpired(e.target.checked)}
                  />
                  Show expired
                </label>
              )}
            </div>
          </div>
          <div className="alarm-list__items">
            {!selectedZone && (
              <div className="alarm-list__empty">
                <div className="alarm-list__empty-icon">📍</div>
                Please select a zone to view scheduled alarms
              </div>
            )}
            {selectedZone && (schedules[selectedZone] || []).length === 0 && (
              <div className="alarm-list__empty">
                <div className="alarm-list__empty-icon">🔔</div>
                No scheduled alarms for Zone {getZoneName(selectedZone)}
              </div>
            )}
            {selectedZone && sortAlarms(schedules[selectedZone] || []).filter(a => showExpired || getAlarmStatus(a).active).map(r => {
              const status = getAlarmStatus(r);
              return (
                <div 
                  key={r.id} 
                  className={`alarm-card ${!status.active ? "alarm-card--expired" : ""}`}
                >
                  <div className="alarm-card__content">
                    <div className="alarm-card__details">
                      {/* Alarm Type Badge */}
                      <div className={`alarm-badge ${r.type === "recurring" ? "alarm-badge--recurring" : "alarm-badge--one-time"}`}>
                        {r.type === "recurring" ? '🔄 RECURRING' : '📅 ONE-TIME'}
                      </div>
                      {/* Status Badge */}
                      {!status.active && (
                        <div className="alarm-badge alarm-badge--expired">
                          {status.label}
                        </div>
                      )}
                      {status.active && status.label === "Active Now" && (
                        <div className="alarm-badge alarm-badge--active-now">
                          ⚡ {status.label}
                        </div>
                      )}

                      {/* Display based on type */}
                      {r.type === "recurring" ? (
                        <>
                          {/* Show alarm mode badge for multi-day alarms */}
                          {r.days.length > 1 && r.alarmMode && (
                            <div className={`alarm-badge ${r.alarmMode === "continuous" ? "alarm-badge--continuous" : "alarm-badge--daily"}`}>
                              {r.alarmMode === "continuous" ? '🔗 CONTINUOUS' : '🔄 DAILY REPEAT'}
                            </div>
                          )}
                          
                          <div className="alarm-time">
                            <div className="alarm-time__text">
                              {r.days.length > 1 && r.alarmMode === "continuous" ? (
                                <>
                                  {r.days[0]} {r.start} → {r.days[r.days.length - 1]} {r.end}
                                </>
                              ) : r.days.length > 1 && r.spansNextDay && (r.alarmMode === "daily" || !r.alarmMode) ? (
                                <>
                                  {r.start} → {r.end} ({getOvernightPairs(r.days).length} overnight{getOvernightPairs(r.days).length !== 1 ? 's' : ''})
                                </>
                              ) : r.days.length > 1 ? (
                                <>
                                  {r.start} → {r.end} ({r.days.length} days)
                                </>
                              ) : (
                                <>
                                  {r.start} → {r.end}
                                </>
                              )}
                            </div>
                            {r.spansNextDay && r.days.length === 1 && (
                              <div className="alarm-badge alarm-badge--overnight">
                                🌙 OVERNIGHT
                              </div>
                            )}
                            {r.spansNextDay && r.days.length > 1 && (r.alarmMode === "daily" || !r.alarmMode) && (
                              <div className="alarm-badge alarm-badge--overnight">
                                🌙 CONTINUES TO NEXT DAY
                              </div>
                            )}
                          </div>
                          <div className="duration-info duration-info--small">
                            {r.days.length > 1 && r.alarmMode === "continuous" ? (
                              <>Total duration: {formatDuration(r.start, r.end, r.spansNextDay, r.days.length)}</>
                            ) : r.days.length > 1 && r.spansNextDay && (r.alarmMode === "daily" || !r.alarmMode) ? (
                              <>Duration per alarm: {formatDuration(r.start, r.end, r.spansNextDay, 1)} × {getOvernightPairs(r.days).length} alarms</>
                            ) : r.days.length > 1 ? (
                              <>Duration per day: {formatDuration(r.start, r.end, r.spansNextDay, 1)} × {r.days.length} alarms</>
                            ) : (
                              <>Duration: {formatDuration(r.start, r.end, r.spansNextDay, 1)}</>
                            )}
                          </div>
                          <div className="alarm-days">
                            {r.spansNextDay && (r.alarmMode === "daily" || !r.alarmMode) ? (
                              // Show overnight pairs for each selected day
                              getOvernightPairs(r.days).map((pair, idx) => (
                                <span 
                                  key={idx}
                                  className="alarm-day-pair"
                                >
                                  {pair[0]} → {pair[1]}
                                </span>
                              ))
                            ) : (
                              // Show individual days
                              r.days.map(day => (
                                <span 
                                  key={day}
                                  className="alarm-day-tag"
                                >
                                  {day}
                                </span>
                              ))
              )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="alarm-datetime">
                            <div className="alarm-datetime__start">
                              {formatDateTime(r.startDateTime)}
                            </div>
                            <div className="alarm-datetime__separator">
                              to
                            </div>
                            <div className="alarm-datetime__end">
                              {formatDateTime(r.endDateTime)}
                            </div>
                          </div>
                          <div className="duration-info duration-info--small">
                            Duration: {formatDateTimeDuration(r.startDateTime, r.endDateTime)}
                          </div>
                        </>
                      )}
                    </div>
                    <button 
                      className="alarm-card__remove"
                      onClick={() => removeRule(selectedZone, r.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedZone && (schedules[selectedZone] || []).length > 0 && (
            <div className="alarm-tip">
              <span>💡</span>
              <span><strong>Tip:</strong> Alarms are persisted on the server and loaded from the database.</span>
            </div>
          )}
        </div>
      </div>

      {/* Map placeholder */}
      <div className="zone-map">
        <h3 className="zone-map__title">
          Zone Layout Preview
        </h3>
        <div className="zone-map__container">
          <SketchMap />
        </div>
      </div>
    </div>
  );

  // Render the prepared JSX
  return Inner;
 }
 
 export default ScheduleAlarms;