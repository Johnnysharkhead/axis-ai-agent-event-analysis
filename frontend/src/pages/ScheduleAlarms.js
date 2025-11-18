import React, { useEffect, useState } from "react";
import "../styles/pages.css";
import "../styles/scheduleAlarms.css";

function ScheduleAlarms({ embedded = false }) {
  const zones = ["A", "B", "C", "D", "E"]; // TODO: fetch later
  const [selectedZone, setSelectedZone] = useState("");
  const [schedules, setSchedules] = useState({});
  // Schedule type: "recurring" or "one-time"
  const [scheduleType, setScheduleType] = useState("recurring");
  // Recurring schedule states
  const [days, setDays] = useState({ Mon:false,Tue:false,Wed:false,Thu:false,Fri:false,Sat:false,Sun:false });
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("07:00");
  const [spansNextDay, setSpansNextDay] = useState(false);
  // Alarm mode: "continuous" (one alarm across all days) or "daily" (separate alarm each day)
  const [alarmMode, setAlarmMode] = useState("daily");
  // One-time schedule states
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info"); // "info", "success", "error"
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [conflictingAlarms, setConflictingAlarms] = useState([]);
  const [replacementData, setReplacementData] = useState(null);
  const [showExpired, setShowExpired] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("zoneSchedules");
      if (raw) setSchedules(JSON.parse(raw));
    } catch {}
  }, []);

  // Auto-detect if end time is before start time (overnight alarm) for recurring
  useEffect(() => {
    if (scheduleType === "recurring") {
      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);
      setSpansNextDay(endMin <= startMin);
    }
  }, [start, end, scheduleType]);

  // DST-safe helpers: format local Date -> "YYYY-MM-DDTHH:MM"
  const pad = (n) => String(n).padStart(2, "0");
  const localDateTimeString = (d, hh, mm) => {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hh)}:${pad(mm)}`;
  };

  // Initialize datetime inputs with sensible defaults for one-time schedules.
  useEffect(() => {
    if (scheduleType === "one-time" && !startDateTime) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // default one-time window: today 22:00 -> next day 07:00 (local time, DST-safe)
      setStartDateTime(localDateTimeString(today, 22, 0));
      setEndDateTime(localDateTimeString(tomorrow, 7, 0));
    }
  }, [scheduleType, startDateTime]);

  // Real-time validation and alarm mode adjustment
  useEffect(() => {
    if (scheduleType === "recurring") {
      const activeDays = Object.keys(days).filter(d => days[d]);
      const adjacent = areAdjacentDays(activeDays);
      
      // If non-adjacent days selected, force daily mode
      if (activeDays.length > 1 && !adjacent) {
        if (alarmMode === "continuous") {
          setAlarmMode("daily");
        }
      }
      
      // Clear old validation message if it exists
      if (message === "Please select adjacent/consecutive days only (e.g., Mon-Tue-Wed).") {
        setMessage("");
        setMessageType("info");
      }
    }
  }, [days, scheduleType, alarmMode]);

  function toggleDay(d) { setDays(p => ({ ...p, [d]: !p[d] })); }
  function timeToMinutes(t){ 
    const [h,m]=(t||"00:00").split(":").map(Number); 
    return h*60+m; 
  }
  // Check if selected days are adjacent/consecutive
  function areAdjacentDays(selectedDays) {
    if (selectedDays.length <= 1) return true;
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const indices = selectedDays.map(day => dayOrder.indexOf(day)).sort((a, b) => a - b);
    
    // Check if indices are consecutive
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i - 1] + 1) {
        return false;
      }
    }
    
    // Special case: Check for Sun-Mon wrap-around (if Sun is last and Mon is first)
    if (indices.includes(0) && indices.includes(6)) {
      // If we have both Mon (0) and Sun (6), check if they're at the ends
      if (indices[0] === 0 && indices[indices.length - 1] === 6) {
        // Check if all days from Mon to some day are consecutive, and Sun is there
        // This means the sequence wraps around (e.g., Sat-Sun-Mon or Sun-Mon-Tue)
        return true;
      }
    }
    
    return true;
  }
  // Get day pairs for overnight alarms - each selected day continues to next day
  function getOvernightPairs(selectedDays) {
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const pairs = [];
    
    selectedDays.forEach(day => {
      const currentIdx = dayOrder.indexOf(day);
      const nextIdx = (currentIdx + 1) % 7; // Wrap around: Sun -> Mon
      pairs.push([day, dayOrder[nextIdx]]);
    });
    
    return pairs;
  }
  
  // Get consecutive day pairs (for continuous mode validation)
  function getConsecutivePairs(selectedDays) {
    if (selectedDays.length <= 1) return [];
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const sorted = [...selectedDays].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    const pairs = [];
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentIdx = dayOrder.indexOf(sorted[i]);
      const nextIdx = dayOrder.indexOf(sorted[i + 1]);
      // Only add pair if days are consecutive
      if (nextIdx === currentIdx + 1) {
        pairs.push([sorted[i], sorted[i + 1]]);
      }
    }
    
    // Special case: Check for Sun-Mon wrap-around
    if (selectedDays.includes("Sun") && selectedDays.includes("Mon")) {
      pairs.push(["Sun", "Mon"]);
    }
    
    return pairs;
  }
  // Calculate duration across multiple days
  function formatDuration(start, end, spansNextDay, dayCount = 1) {
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    let durationMin;
    if (dayCount > 1) {
      // Multi-day alarm: from start time on first day to end time on last day
      // Full days in between + partial first and last days
      const fullDays = dayCount - 1;
      const firstDayMin = 1440 - startMin; // From start time to midnight
      const lastDayMin = endMin; // From midnight to end time
      durationMin = firstDayMin + (fullDays - 1) * 1440 + lastDayMin;
    } else if (spansNextDay) {
      durationMin = (1440 - startMin) + endMin; // Minutes until midnight + minutes after midnight
    } else {
      durationMin = endMin - startMin;
    }
    const days = Math.floor(durationMin / 1440);
    const remainingMin = durationMin % 1440;
    const hours = Math.floor(remainingMin / 60);
    const minutes = remainingMin % 60;
    let result = [];
    if (days > 0) result.push(`${days}d`);
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0) result.push(`${minutes}m`);
    return result.length > 0 ? result.join(' ') : '0m';
  }

  function formatDateTimeDuration(startDT, endDT) {
    const start = new Date(startDT);
    const end = new Date(endDT);
    const diffMs = end - start;
    if (diffMs <= 0) return "Invalid";
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.length > 0 ? parts.join(' ') : '0m';
  }

  function formatDateTime(dateTimeStr) {
    const dt = new Date(dateTimeStr);
    const date = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
  }

  function isDuplicateAlarm(zone, newAlarm) {
    const existing = schedules[zone] || [];
    return existing.some(rule => {
      if (rule.type !== newAlarm.type) return false;
      if (newAlarm.type === "recurring") {
        const sameDays = JSON.stringify(rule.days.sort()) === JSON.stringify(newAlarm.days.sort());
        const sameTime = rule.start === newAlarm.start && rule.end === newAlarm.end && rule.spansNextDay === newAlarm.spansNextDay;
        const sameMode = rule.alarmMode === newAlarm.alarmMode;
        return sameDays && sameTime && sameMode;
      } else {
        return rule.startDateTime === newAlarm.startDateTime && rule.endDateTime === newAlarm.endDateTime;
      }
    });
  }

  // Check if two time ranges overlap (for same day)
  function timeRangesOverlap(start1, end1, spans1, start2, end2, spans2) {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1) + (spans1 ? 1440 : 0); // Add 24h if overnight
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2) + (spans2 ? 1440 : 0);
    
    return s1 < e2 && s2 < e1;
  }

  // Check if new alarm completely contains existing alarm (for replacement)
  function alarmContainsAnother(newStart, newEnd, newSpans, existStart, existEnd, existSpans) {
    const ns = timeToMinutes(newStart);
    const ne = timeToMinutes(newEnd) + (newSpans ? 1440 : 0);
    const es = timeToMinutes(existStart);
    const ee = timeToMinutes(existEnd) + (existSpans ? 1440 : 0);
    
    return ns <= es && ne >= ee;
  }

  // Get days that would be affected by an alarm (for overnight daily mode)
  function getAffectedDays(alarm) {
    if (alarm.type !== "recurring") return [];
    
    // For overnight daily mode, each selected day affects the next day too
    if (alarm.alarmMode === "daily" && alarm.spansNextDay) {
      return getOvernightPairs(alarm.days).flat();
    }
    
    return alarm.days;
  }

  // Find conflicting and superseded alarms
  function findConflicts(zone, newAlarm) {
    const existing = schedules[zone] || [];
    const conflicts = [];
    const superseded = [];

    existing.forEach(existingAlarm => {
      // Only check recurring alarms against recurring, one-time against one-time
      if (existingAlarm.type !== newAlarm.type) return;

      if (newAlarm.type === "recurring") {
        const newAffectedDays = getAffectedDays(newAlarm);
        const existAffectedDays = getAffectedDays(existingAlarm);
        
        // Check if they share any days
        const sharedDays = newAffectedDays.filter(d => existAffectedDays.includes(d));
        
        if (sharedDays.length > 0) {
          // Check time overlap
          if (timeRangesOverlap(
            newAlarm.start, newAlarm.end, newAlarm.spansNextDay,
            existingAlarm.start, existingAlarm.end, existingAlarm.spansNextDay
          )) {
            // Check if new alarm completely contains existing alarm
            if (alarmContainsAnother(
              newAlarm.start, newAlarm.end, newAlarm.spansNextDay,
              existingAlarm.start, existingAlarm.end, existingAlarm.spansNextDay
            ) && sharedDays.length === existAffectedDays.length) {
              superseded.push(existingAlarm);
            } else {
              conflicts.push(existingAlarm);
            }
          }
        }
      } else {
        // One-time alarms
        const newStart = new Date(newAlarm.startDateTime);
        const newEnd = new Date(newAlarm.endDateTime);
        const existStart = new Date(existingAlarm.startDateTime);
        const existEnd = new Date(existingAlarm.endDateTime);

        // Check if they overlap
        if (newStart < existEnd && existStart < newEnd) {
          // Check if new alarm completely contains existing alarm
          if (newStart <= existStart && newEnd >= existEnd) {
            superseded.push(existingAlarm);
          } else {
            conflicts.push(existingAlarm);
          }
        }
      }
    });

    return { conflicts, superseded };
  }

  function addAlarm() {
    if (!selectedZone) {
      setMessage("Please select a zone first");
      setMessageType("error");
      return;
    }
    let newAlarm;
    if (scheduleType === "recurring") {
      const activeDays = Object.keys(days).filter(d => days[d]);
      if (!activeDays.length) {
        setMessage("Please select at least one day");
        setMessageType("error");
        return;
      }
      
      // For continuous mode, days must be adjacent
      if (alarmMode === "continuous" && activeDays.length > 1 && !areAdjacentDays(activeDays)) {
        setMessage("Continuous alarms require adjacent days. Use Daily mode for non-adjacent days.");
        setMessageType("error");
        return;
      }
      
      newAlarm = {
        id: Date.now(),
        type: "recurring",
        days: activeDays,
        start,
        end,
        spansNextDay,
        alarmMode,
        enabled: true
      };
    } else {
      // One-time schedule
      if (!startDateTime || !endDateTime) {
        setMessage("Please set both start and end date/time.");
        setMessageType("error");
        return;
      }
      const startDT = new Date(startDateTime);
      const endDT = new Date(endDateTime);
      if (endDT <= startDT) {
        setMessage("End date/time must be after start date/time.");
        setMessageType("error");
        return;
      }
      // Check if the alarm is in the past
      const now = new Date();
      if (endDT < now) {
        setMessage("Cannot schedule alarm in the past.");
        setMessageType("error");
        return;
      }
      newAlarm = {
        id: Date.now(),
        type: "one-time",
        startDateTime,
        endDateTime,
        enabled: true
      };
    }
    // Check for duplicate
    if (isDuplicateAlarm(selectedZone, newAlarm)) {
      setShowDuplicateModal(true);
      return;
    }

    // Check for conflicts and superseded alarms
    const { conflicts, superseded } = findConflicts(selectedZone, newAlarm);
    
    if (conflicts.length > 0) {
      // There are conflicting alarms that don't get replaced
      setConflictingAlarms(conflicts);
      setShowConflictModal(true);
      return;
    }
    
    if (superseded.length > 0) {
      // New alarm supersedes existing alarms - show confirmation
      setReplacementData({ newAlarm, superseded });
      setShowReplacementModal(true);
      return;
    }

    // No conflicts or superseded alarms - proceed normally
    setSchedules(prev => {
      const next = { ...prev, [selectedZone]: [...(prev[selectedZone] || []), newAlarm] };
      localStorage.setItem("zoneSchedules", JSON.stringify(next));
      return next;
    });
    setMessage(`Alarm successfully added to Zone ${selectedZone}`);
    setMessageType("success");
    resetForm();
  }

  function removeRule(zone,id){
    setSchedules(prev=>{
      const next={...prev,[zone]:(prev[zone]||[]).filter(r=>r.id!==id)};
      localStorage.setItem("zoneSchedules", JSON.stringify(next));
      return next;
    });
    setMessage("Alarm removed successfully");
    setMessageType("info");
  }

  function confirmReplacement() {
    if (!replacementData) return;
    
    const { newAlarm, superseded } = replacementData;
    const supersededIds = superseded.map(a => a.id);
    
    setSchedules(prev => {
      // Remove superseded alarms and add new one
      const filtered = (prev[selectedZone] || []).filter(r => !supersededIds.includes(r.id));
      const next = { ...prev, [selectedZone]: [...filtered, newAlarm] };
      localStorage.setItem("zoneSchedules", JSON.stringify(next));
      return next;
    });
    
    setMessage(`Alarm added and ${superseded.length} existing alarm${superseded.length > 1 ? 's' : ''} replaced`);
    setMessageType("success");
    setShowReplacementModal(false);
    setReplacementData(null);
    resetForm();
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
    const hl = id => (selectedZone === id ? { stroke:"#000", strokeWidth:3 } : {});
    return (
      <div style={{ width:"100%", display:"flex", justifyContent:"center" }}>
        <svg width="100%" height="300" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width="600" height="300" fill="#eef6ff" rx="8" />
          <rect x="40" y="25" width="520" height="250" fill="#ffffff" stroke="#3b82f6" strokeWidth="4" rx="10" />
          <rect x="60" y="45" width="220" height="105" fill="#fff1f0" stroke="#ff7b7b" rx="6" style={{ opacity:0.9, ...hl("A") }} />
          <text x="170" y="105" textAnchor="middle" fontSize="26" fontWeight="600" fill="#7a1b1b">A</text>
          <rect x="320" y="45" width="220" height="105" fill="#e9fff2" stroke="#6be27a" rx="6" style={{ opacity:0.9, ...hl("B") }} />
          <text x="430" y="105" textAnchor="middle" fontSize="26" fontWeight="600" fill="#0b6b34">B</text>
          <rect x="200" y="100" width="200" height="120" fill="#fffbe6" stroke="#ffbf47" rx="6" style={{ opacity:0.85, ...hl("C") }} />
          <text x="300" y="160" textAnchor="middle" fontSize="26" fontWeight="600" fill="#7a4b00">C</text>
          <rect x="60" y="175" width="220" height="105" fill="#fff4e6" stroke="#ffb86b" rx="6" style={{ opacity:0.9, ...hl("D") }} />
          <text x="170" y="235" textAnchor="middle" fontSize="26" fontWeight="600" fill="#6b3f00">D</text>
          <rect x="320" y="175" width="220" height="105" fill="#eef2ff" stroke="#94a8ff" rx="6" style={{ opacity:0.9, ...hl("E") }} />
          <text x="430" y="235" textAnchor="middle" fontSize="26" fontWeight="600" fill="#2b3f7a">E</text>
          <text x="50" y="20" fontSize="12" fill="#374151">Zone sketch (placeholder)</text>
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
            <select
              value={selectedZone}
              onChange={e => { setSelectedZone(e.target.value); setMessage(""); }}
              className="schedule-alarms__zone-dropdown"
            >
              <option value="">-- Select Zone --</option>
              {zones.map(z => <option key={z} value={z}>Zone {z}</option>)}
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
                  Zone {selectedZone} · {(schedules[selectedZone] || []).filter(a => showExpired || getAlarmStatus(a).active).length} alarm{(schedules[selectedZone] || []).filter(a => showExpired || getAlarmStatus(a).active).length !== 1 ? 's' : ''}
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
                No scheduled alarms for Zone {selectedZone}
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
              <span><strong>Tip:</strong> Alarms are saved automatically and persist in your browser.</span>
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

  if (embedded) return Inner;

  return (
    <section className="page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Zone Alarm Management</h1>
          <p className="subtitle">Schedule recurring or one-time alarms for different zones with flexible time ranges</p>
        </header>
      </div>
      {Inner}
    </section>
  );
}

export default ScheduleAlarms;