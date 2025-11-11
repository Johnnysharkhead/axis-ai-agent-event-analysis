import React, { useState, useEffect } from "react";
import "../styles/pages.css";
import RoomConfiguration from "../components/RoomConfiguration";

function Floormap2D() {
  const [roomConfig, setRoomConfig] = useState({ width: 10, depth: 10, cameraHeight: 2 });
  const [isConfigVisible, setIsConfigVisible] = useState(true);
  const [cameras, setCameras] = useState([]);
  const [highlightEdges, setHighlightEdges] = useState(false);
  const [firstCameraPlaced, setFirstCameraPlaced] = useState(false);

  // Fetch cameras from the backend when the component mounts
  const handleSaveConfig = (newConfig) => {
        setRoomConfig(newConfig);
        fetch("http://localhost:5001/floorplan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            floorplan_name: newConfig.name,
            floorplan_width: newConfig.width,
            floorplan_depth: newConfig.depth,
            camera_height: newConfig.cameraHeight,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            console.log("Floorplan POST response:", data);
            newConfig.new_floorplan_id = data.new_floorplan_id;
    
            // Fetch cameras only after room is created
            fetch("http://localhost:5001/cameras")
              .then((res) => res.json())
              .then((data) => {
                if (data.cameras) {
                  const updatedCameras = data.cameras.map((camera) => ({
                    ...camera,
                    x: null,
                    y: null,
                    placed: false,
                  }));
                  setCameras(updatedCameras);
                }
              })
              .catch((err) => {
                console.error("Failed to fetch cameras:", err);
              });
          })
          .catch((err) => {
            console.error("Failed to add floorplan:", err);
          });
        console.log("Room Configuration Saved:", newConfig);
      };

  const handleDropCamera = (cameraId, normalizedX, normalizedY) => {
    setCameras((prevCameras) =>
      prevCameras.map((camera) =>
        camera.id === cameraId
          ? { ...camera, x: normalizedX, y: normalizedY, placed: true }
          : camera
      )
    );
    console.log(`Camera ${cameraId} placed at (${normalizedX}, ${normalizedY})`);

    if (!firstCameraPlaced) {
      fetch(`http://localhost:5001/floorplan/${roomConfig.new_floorplan_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_id: cameraId,
          placed_coords: [normalizedX, normalizedY], // tuple as array in JSON
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Camera placement PUT response:", data);
        })
        .catch((err) => {
          console.error("Failed to update floorplan with camera:", err);
        });
    }
  };

  const handleRemoveCamera = (cameraId) => {
    const confirmRemove = window.confirm("Are you sure you want to remove this camera?");
    if (confirmRemove) {
      setCameras((prevCameras) =>
        prevCameras.map((camera) =>
          camera.id === cameraId ? { ...camera, x: null, y: null, placed: false } : camera
        )
      );
      console.log(`Camera ${cameraId} removed from the map`);
    }
  };

  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Floormap 2D</h1>
      </header>

      {/* Toggle Configuration Panel */}
      <button
        onClick={() => setIsConfigVisible(!isConfigVisible)}
        style={{
          marginBottom: "1rem",
          padding: "0.3rem 0.8rem",
          backgroundColor: "#f0f0f0",
          color: "#333",
          border: "1px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        {isConfigVisible ? "Hide Configuration" : "Show Configuration"}
      </button>

      {/* Room Configuration Panel */}
      {isConfigVisible && <RoomConfiguration onSave={handleSaveConfig} />}

      {/* Room Map */}
      <div
        style={{
          position: "relative",
          width: `${roomConfig.width * 10}px`,
          height: `${roomConfig.depth * 10}px`,
          maxWidth: "500px",
          maxHeight: "500px",
          border: "2px solid black",
          backgroundColor: "#f9f9f9",
          boxShadow: highlightEdges
            ? "inset 0px 0px 10px 2px rgba(0, 123, 255, 0.5)"
            : "none",
          transition: "all 0.3s ease",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          const rect = e.target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const isOnEdge =
            x <= 10 ||
            x >= rect.width - 10 ||
            y <= 10 ||
            y >= rect.height - 10;

          setHighlightEdges(isOnEdge);
        }}
        onDragLeave={() => setHighlightEdges(false)}
        onDrop={(e) => {
          setHighlightEdges(false);
          const cameraId = parseInt(e.dataTransfer.getData("cameraId"), 10);
          const rect = e.target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const isOnEdge =
            x <= 10 ||
            x >= rect.width - 10 ||
            y <= 10 ||
            y >= rect.height - 10;

          if (isOnEdge) {
            let normalizedX = (x / rect.width) * roomConfig.width;
            let normalizedY = roomConfig.depth - (y / rect.height) * roomConfig.depth;

            if (x <= 10) normalizedX = 0;
            if (x >= rect.width - 10) normalizedX = roomConfig.width;
            if (y <= 10) normalizedY = roomConfig.depth;
            if (y >= rect.height - 10) normalizedY = 0;

            handleDropCamera(cameraId, normalizedX, normalizedY);
          } else {
            console.log("Camera must be placed on the edge!");
          }
        }}
      >
        {/* Render cameras as blue circles */}
        {cameras
          .filter((camera) => camera.placed)
          .map((camera) => (
            <div
              key={camera.id}
              style={{
                position: "absolute",
                left: `${(camera.x / roomConfig.width) * 100}%`,
                bottom: `${(camera.y / roomConfig.depth) * 100}%`,
                transform: "translate(-50%, 50%)", // Center the circle on the edge
                width: "10px",
                height: "10px",
                backgroundColor: "blue",
                borderRadius: "50%",
                boxShadow: "0 0 5px rgba(0, 0, 255, 0.8)",
              }}
            />
          ))}
      </div>

      {/* Control Panel for Placed Cameras */}
      <div style={{ marginTop: "1rem" }}>
        <h3>Placed Cameras</h3>
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {cameras
            .filter((camera) => camera.placed)
            .map((camera) => (
              <li
                key={camera.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                  padding: "0.5rem",
                  backgroundColor: "#f9f9f9",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              >
                <span>
                  Camera {camera.id} - Coordinates: ({camera.x.toFixed(2)}, {camera.y.toFixed(2)})
                </span>
                <button
                  onClick={() => handleRemoveCamera(camera.id)}
                  style={{
                    padding: "2px 5px",
                    fontSize: "0.8rem",
                    backgroundColor: "#ff4d4d",
                    color: "white",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
        </ul>
      </div>

      {/* Camera Selection */}
      <div style={{ marginTop: "1rem" }}>
        <h3>Select and Drag Cameras</h3>
        <div style={{ display: "flex", gap: "1rem" }}>
          {cameras
            .filter((camera) => !camera.placed)
            .sort((a, b) => a.id - b.id)
            .map((camera) => (
              <div
                key={camera.id}
                draggable
                onDragStart={(e) => {
                  console.log(`Dragging camera with ID: ${camera.id}`);
                  e.dataTransfer.setData("cameraId", camera.id);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#007bff",
                  color: "white",
                  borderRadius: "4px",
                  cursor: "grab",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: "bold" }}>{camera.name}</span>
                <span style={{ fontSize: "0.8rem", color: "#ccc" }}>ID: {camera.id}</span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

export default Floormap2D;
