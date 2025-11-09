/**
 * Gridmap.js
 * A grid of cells that can be painted with different colors depending on current Color.
 * Supports painting mode and dragging/selection mode.
 * Cell colors are saved to localStorage and can be exported/imported as JSON.
 * AUTHORS: Astrix Karlsson, Success 
 */

import React, { useEffect, useRef, useState } from "react";

// persistent config
const STORAGE_VERSION = 1;
const SITE_ID = "default"; // change later (e.g., "hq-1")
const FLOOR_ID = "floor-0"; // change later (e.g., "level-1")
const STORAGE_KEY = `floormap:${SITE_ID}:${FLOOR_ID}:v${STORAGE_VERSION}`;

function Gridmap({
  rows = 5,
  cols = 5,
  currentColor = null,
  currentTool = "paint",
  displayMode = false, // if true, disable editing and view without grid lines and borders
}) {
  // cellColors is a flat array of length rows*cols, each entry is a color string or null
  const [cellColors, setCellColors] = useState(() =>
    Array(rows * cols).fill(null)
  );
  const [isPainting, setIsPainting] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // true while dragging
  const [dragStart, setDragStart] = useState(null); // { row, col } when drag starts
  const [dragEnd, setDragEnd] = useState(null); // { row, col } while dragging

  // save state + helpers
  const [saveState, setSaveState] = useState("saved");
  const saveTimer = useRef(null);
  const fileInputRef = useRef(null);

  // restore on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      const ok =
        parsed?.version === STORAGE_VERSION &&
        parsed?.rows === rows &&
        parsed?.cols === cols &&
        Array.isArray(parsed?.cellColors) &&
        parsed.cellColors.length === rows * cols;

      if (ok) setCellColors(parsed.cellColors);
    } catch {
      // ignore corrupted storage
    }
  }, [rows, cols]);

  // fallback
  useEffect(() => {
    setCellColors((prev) =>
      prev.length === rows * cols ? prev : Array(rows * cols).fill(null)
    );
  }, [rows, cols]);

  // for painting
  const handleCellPaint = (r, c) => {
    if (!currentColor) return;
    const idx = r * cols + c;
    setCellColors((prev) => {
      const next = [...prev];

      //Hard coded to allow deletion when currentColor is black
      if (currentColor === "#000000") {
        next[idx] = null;
      } else {
        next[idx] = currentColor;
      }
      return next;
    });
  };

  // mouse release anywhere
  useEffect(() => {
    const handleMouseUp = () => setIsPainting(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  //debounce
  useEffect(() => {
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const payload = {
          version: STORAGE_VERSION,
          rows,
          cols,
          cellColors,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } finally {
        setSaveState("saved");
      }
    }, 300);

    return () => clearTimeout(saveTimer.current);
  }, [cellColors, rows, cols]);

  // for export, import and reset
  function exportJSON() {
    const data = JSON.stringify(
      { version: STORAGE_VERSION, rows, cols, cellColors },
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floormap-${SITE_ID}-${FLOOR_ID}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Global mouseup listener
  useEffect(() => {
    const handleMouseUp = () => {
      // Stop painting regardless of tool
      setIsPainting(false);

      // Only run if a drag selection is active
      if (isDragging && dragStart && dragEnd) {
        console.log("Drag selection:", dragStart, dragEnd);

        // Compute the rectangle boundaries
        const startRow = Math.min(dragStart.row, dragEnd.row);
        const endRow = Math.max(dragStart.row, dragEnd.row);
        const startCol = Math.min(dragStart.col, dragEnd.col);
        const endCol = Math.max(dragStart.col, dragEnd.col);

        // Apply currentColor (or null for erase) to all cells in rectangle
        setCellColors((prev) => {
          const next = [...prev];
          for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
              const idx = r * cols + c;
              if (currentColor === "#000000") {
                next[idx] = null;
              } else {
                next[idx] = currentColor ? currentColor : null;
              }
            }
          }
          return next;
        });

        // Reset drag state
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
      }
    };

    // Attach global mouseup listener
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDragging, dragStart, dragEnd, currentColor, cols]);

  // Centralized handlers
  const handleMouseDown = (r, c) => {
    if (currentTool === "paint" && currentColor) {
      setIsPainting(true);
      handleCellPaint(r, c);
    } else if (currentTool === "drag") {
      setIsDragging(true);
      setDragStart({ row: r, col: c });
      setDragEnd({ row: r, col: c });
    }
  };

  const handleMouseEnter = (r, c) => {
    if (currentTool === "paint" && isPainting && !displayMode) handleCellPaint(r, c);
    else if (currentTool === "drag" && isDragging) {
      setDragEnd({ row: r, col: c });
    }
  };

  // Generate grid items
  const gridItems = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const bg = cellColors[idx] || "transparent";

      gridItems.push(
        <div
          key={`${r}-${c}`}
          style={{
            background: bg,
            border: "1px solid #ccc",
            aspectRatio: "1 / 1",
            userSelect: "none",
          }}
          // Use your centralized handlers
          onMouseDown={() => handleMouseDown(r, c)}
          onMouseEnter={() => handleMouseEnter(r, c)}
        />
      );
    }
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const ok =
          parsed?.rows === rows &&
          parsed?.cols === cols &&
          Array.isArray(parsed?.cellColors) &&
          parsed.cellColors.length === rows * cols;

        if (!ok) return alert("Layout doesn't match current grid size.");
        setCellColors(parsed.cellColors);
      } catch {
        alert("Invalid layout file.");
      }
    };
    reader.readAsText(file);
  }

  function resetLayout() {
    setCellColors(Array(rows * cols).fill(null));
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Toolbar: Export / Import / Reset */}
      <div className="gridmap-toolbar">
        <button onClick={exportJSON} className="gridmap-toolbar__button" title="Export layout">
          Export
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="gridmap-toolbar__button"
          title="Import layout"
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
        />
        <button onClick={resetLayout} className="gridmap-toolbar__button" title="Reset layout">
          Reset
        </button>
      </div>

      {/* The grid */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "1px",
          width: "100%",
          height: "100%",
          cursor: currentColor ? "crosshair" : "default",
        }}
      >
        {gridItems}
      </div>

      {/* Saved / Saving indicator */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          fontSize: 13,
          color: saveState === "saving" ? "#1d4ed8" : "#16a34a",
          background: "rgba(255,255,255,0.95)",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "3px 10px",
          fontWeight: "500",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        {saveState === "saving" ? "Saving…" : "Saved"}
      </div>
    </div>
  );
}

const btnStyle = {
  border: "1px solid #d1d5db",
  background: "#fff",
  padding: "4px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
};

export default Gridmap;
