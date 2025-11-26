import React, { useEffect, useRef, useState } from 'react';
import '../styles/HeatmapOverlay.css';

/**
 * HeatmapOverlay Component
 * Fetches and renders a heatmap visualization showing where people have walked
 * @param {number} duration - Time window in seconds
 * @param {number} floorplanWidth - Width of floorplan in meters
 * @param {number} floorplanHeight - Height of floorplan in meters
 * @param {boolean} enabled - Whether heatmap is enabled
 */
function HeatmapOverlay({ duration = 600, floorplanWidth = 10, floorplanHeight = 10, enabled = true }) {
  const canvasRef = useRef(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch heatmap data from backend
  useEffect(() => {
    if (!enabled) return;

    const fetchHeatmapData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:5001/heatmap/data?duration=${duration}&grid_size=50&floorplan_width=${floorplanWidth}&floorplan_height=${floorplanHeight}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setHeatmapData(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch heatmap data');
        }
      } catch (err) {
        console.error('Heatmap fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchHeatmapData();

    // Refresh every 10 seconds
    const interval = setInterval(fetchHeatmapData, 10000);

    return () => clearInterval(interval);
  }, [duration, floorplanWidth, floorplanHeight, enabled]);

  // Render heatmap on canvas
  useEffect(() => {
    if (!heatmapData || !canvasRef.current || !enabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { grid, grid_size } = heatmapData;

    // Set high-resolution canvas for better blur quality
    const rect = canvas.parentElement.getBoundingClientRect();
    const scale = 2; // Higher resolution for smoother blur
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate cell size
    const cellWidth = canvas.width / grid_size;
    const cellHeight = canvas.height / grid_size;

    // Draw heatmap with radial gradients for smooth blending
    for (let y = 0; y < grid_size; y++) {
      for (let x = 0; x < grid_size; x++) {
        const intensity = grid[y][x];

        if (intensity > 0) {
          // Calculate center of cell
          const centerX = (x + 0.5) * cellWidth;
          const canvasY = canvas.height - (y + 0.5) * cellHeight;

          const color = getHeatColor(intensity);
          // Parse rgba color: rgba(r, g, b, a)
          const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
          const r = match[1];
          const g = match[2];
          const b = match[3];
          const alpha = match[4] ? parseFloat(match[4]) : 1;

          // Apply blur/glow effect only to colored cells
          ctx.shadowBlur = 0;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`;

          // Create radial gradient for smooth blending
          const radius = Math.max(cellWidth, cellHeight) * 1;
          const gradient = ctx.createRadialGradient(
            centerX, canvasY, 0,
            centerX, canvasY, radius
          );

          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
          gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = gradient;
          ctx.fillRect(
            (x) * cellWidth,
            canvas.height - (y + 1) * cellHeight,
            cellWidth,
            cellHeight
          );
        }
      }
    }

    // Reset shadow for any subsequent drawing
    ctx.shadowBlur = 0;
  }, [heatmapData, enabled]);

  // Generate heat color based on intensity (0-1)
  const getHeatColor = (intensity) => {
    if (intensity <= 0) return 'rgba(0, 0, 255, 0)';

    // Color gradient: Blue -> Cyan -> Green -> Yellow -> Orange -> Red
    let r, g, b;

    if (intensity < 0.2) {
      // Blue to Cyan
      const t = intensity / 0.2;
      r = 0;
      g = Math.floor(255 * t);
      b = 255;
    } else if (intensity < 0.4) {
      // Cyan to Green
      const t = (intensity - 0.2) / 0.2;
      r = 0;
      g = 255;
      b = Math.floor(255 * (1 - t));
    } else if (intensity < 0.6) {
      // Green to Yellow
      const t = (intensity - 0.4) / 0.2;
      r = Math.floor(255 * t);
      g = 255;
      b = 0;
    } else if (intensity < 0.8) {
      // Yellow to Orange
      const t = (intensity - 0.6) / 0.2;
      r = 255;
      g = Math.floor(255 * (1 - t * 0.5));
      b = 0;
    } else {
      // Orange to Red
      const t = (intensity - 0.8) / 0.2;
      r = 255;
      g = Math.floor(128 * (1 - t));
      b = 0;
    }
    const alpha = Math.min(1.4, 0.9 + intensity * 0.8);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  if (!enabled) return null;

  return (
    <div className="heatmap-overlay">
      <canvas ref={canvasRef} className="heatmap-overlay-canvas" />

      {/* Status indicators */}
      {loading && (
        <div className="heatmap-status-indicator">
          Loading heatmap...
        </div>
      )}

      {error && (
        <div className="heatmap-status-indicator error">
          Error: {error}
        </div>
      )}

      {heatmapData && !loading && (
        <div className="heatmap-info-box">
          <div>Heatmap: Last {Math.floor(duration / 60)} minutes</div>
          <div>{heatmapData.total_positions} positions tracked</div>
        </div>
      )}
    </div>
  );
}

export default HeatmapOverlay;
