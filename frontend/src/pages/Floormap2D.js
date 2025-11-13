import React, { useState, useEffect } from "react";
import "../styles/pages.css";
import RoomConfiguration from "../components/RoomConfiguration";

function Floormap2D() {
  const [roomConfig, setRoomConfig] = useState({ width: 10, depth: 10, cameraHeight: 2 });
  const [isConfigVisible, setIsConfigVisible] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [highlightEdges, setHighlightEdges] = useState(false);
  const [firstCameraPlaced, setFirstCameraPlaced] = useState(false);
  const [floorplans, setFloorplans] = useState([]);
  const [selectedFloorplan, setSelectedFloorplan] = useState(null);
  const [people, setPeople] = useState({});
  const [useMockStream, setUseMockStream] = useState(false);
  const [newCamera, setNewCamera] = useState({ x: "", y: "" });

  useEffect(() => {

    const streamUrl = useMockStream
      ? 'http://localhost:5001/test/mock-stream' //Connect to testing stream
      : 'http://localhost:5001/stream/positions'; //Connect to position REAL positon stream

    const eventSource = new EventSource(streamUrl);
    console.log(`Connected to ${useMockStream ? 'MOCK' : 'REAL'} position stream`);

    eventSource.onmessage = (e) => {
      const pos = JSON.parse(e.data);
      console.log('Position update:', pos);

      //Add people with postion and timestamp of lastseen
      setPeople(prev => ({
        ...prev,
        [pos.track_id]: {
          x_m: pos.x_m,
          y_m: pos.y_m,
          lastSeen: Date.now()
        }
      }));
    };

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
    };


    return () => {
      eventSource.close(); //stop listening when disconnect from stream
    };
  }, [useMockStream]); //Reconnect when switching between real and test stream

  //Remove people that havent been seen for 30s
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setPeople(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(trackId => {
          // Remove track if not seen in last 30 seconds
          if (now - updated[trackId].lastSeen > 30000) {
            console.log(`Removing stale track: ${trackId}`);
            delete updated[trackId];
          }
        });
        return updated;
      });
    }, 1000); //Updated once a second

    return () => clearInterval(cleanup);
  }, []);

  useEffect(() => {
    fetch("http://localhost:5001/floorplan")
      .then((res) => res.json())
      .then((data) => {
        if (data.floorplans) {
          setFloorplans(data.floorplans);
        }
      })
      .catch((err) => console.error("Failed to fetch floorplans:", err));
  }, []);

  const fetchCameras = () => {
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
  };

  const handleFetchFloorplans = () => {
    fetch("http://localhost:5001/floorplan", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.floorplans) {
          console.log("Fetched floorplans:", data.floorplans);
          setFloorplans(data.floorplans);
        } else {
          console.error("No floorplans found in the database.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch floorplans:", err);
      });
  };

  const handleSelectFloorplan = (floorplanId) => {
    fetch(`http://localhost:5001/floorplan/${floorplanId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.floorplan) {
          const { width, depth, camera_height, cameras } = data.floorplan;
          setRoomConfig({ width, depth, cameraHeight: camera_height });
          setCameras(
            cameras.map((camera) => ({
              ...camera,
              placed: true,
            }))
          );
          console.log(`Loaded floorplan: ${data.floorplan.name}`);

        } else {
          console.error("No floorplan found.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch floorplan:", err);
      });
  };

  useEffect(() => {
    handleFetchFloorplans();
  }, []);


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
        fetchCameras();
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
          placed_coords: [normalizedX, normalizedY],
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

  const handleSelectFloorplanChange = (e) => {
    const floorplan = floorplans.find(fp => fp.id === parseInt(e.target.value));
    setSelectedFloorplan(floorplan);

    if (floorplan) {
      setRoomConfig({
        width: floorplan.width,
        depth: floorplan.depth,
        cameraHeight: floorplan.camera_height || 2,
        name: floorplan.name,
        new_floorplan_id: floorplan.id,
      });
      console.log("Floorplan selected");
      console.log(floorplan);

      let prePlacedCamera = null;
      if (floorplan.camera_floorplancoordinates && Array.isArray(floorplan.camera_floorplancoordinates)) {
        prePlacedCamera = {
          id: "virtual",
          name: "Previously placed camera",
          x: floorplan.camera_floorplancoordinates[0],
          y: floorplan.camera_floorplancoordinates[1],
          placed: true,
        };
        setCameras([prePlacedCamera]);
      } else {
        setCameras([]);
      }

      fetch("http://localhost:5001/cameras")
        .then((res) => res.json())
        .then((data) => {
          console.log(data)
          let fetchedCameras = [];
          if (data.cameras) {
            fetchedCameras = data.cameras.map((camera) => ({
              ...camera,
              x: camera.placed_coords ? camera.placed_coords[0] : null,
              y: camera.placed_coords ? camera.placed_coords[1] : null,
              placed: !!camera.placed_coords,
            }));
          }

          const placedCameraIds = [];
          if (prePlacedCamera && prePlacedCamera.id !== "virtual") {
            placedCameraIds.push(prePlacedCamera.id);
          }
          if (floorplan.cameras && Array.isArray(floorplan.cameras)) {
            floorplan.cameras.forEach(cam => {
              if (cam.id !== undefined && cam.id !== null) placedCameraIds.push(cam.id);
            });
          }

          const filteredCameras = fetchedCameras.filter(
            (camera) => !placedCameraIds.includes(camera.id)
          );

          if (prePlacedCamera) {
            setCameras([prePlacedCamera, ...filteredCameras]);
          } else {
            setCameras(filteredCameras);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch cameras:", err);
        });
    }
  };

  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Floormap 2D</h1>
        <p className="subtitle">Configure and monitor your floorplan in real-time</p>
      </header>

      {/* Main layout: Sidebar (left) + Floormap (right) */}
      <div className="page__split page__split--sidebar">

        {/* LEFT SIDEBAR - Settings & Configuration */}
        <aside className="page__stack">

          {/* Floorplan Selection */}
          <div className="page__section">
            <h3 className="page__section-title">Floorplan Selection</h3>
            <div>
              <label htmlFor="floorplan-select" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "var(--color-text)" }}>
                Select a Floorplan
              </label>
              <select
                id="floorplan-select"
                value={selectedFloorplan?.id || ""}
                onChange={handleSelectFloorplanChange}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text)",
                }}
              >
                <option value="">-- Select a Floorplan --</option>
                {floorplans.map((fp) => (
                  <option key={fp.id} value={fp.id}>
                    {fp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stream Settings */}
          <div className="page__section">
            <h3 className="page__section-title">Stream Settings</h3>
            <button
              onClick={() => {
                setUseMockStream(!useMockStream);
                setPeople({});
              }}
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: useMockStream ? "#4CAF50" : "#ff9800",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "600",
                transition: "all 0.2s ease",
              }}
            >
              {useMockStream ? "Using MOCK Stream" : "Using REAL Stream"}
            </button>
            <small style={{ color: "var(--color-muted)", fontSize: "0.85rem", display: "block", marginTop: "0.5rem" }}>
              {useMockStream ? "Test mode: Simulated people movement" : "Live mode: Real camera data"}
            </small>
          </div>

          {/* Room Configuration Toggle */}
          <div className="page__section">
            <button
              onClick={() => setIsConfigVisible(!isConfigVisible)}
              className="page__control"
              style={{ width: "100%", justifyContent: "center" }}
            >
              {isConfigVisible ? "Hide" : "Show"} Room Configuration
            </button>
          </div>

          {/* Room Configuration Panel */}
          {isConfigVisible && (
            <div className="page__section">
              <h3 className="page__section-title">Room Configuration</h3>
              <RoomConfiguration onSave={handleSaveConfig} />
            </div>
          )}

          {/* Active People Panel */}
          <div className="page__section">
            <h3 className="page__section-title">Active People ({Object.keys(people).length})</h3>
            {Object.keys(people).length === 0 ? (
              <p style={{ color: "var(--color-muted)", fontStyle: "italic", margin: 0 }}>No people detected</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {Object.entries(people).map(([trackId, person]) => (
                  <div
                    key={trackId}
                    style={{
                      padding: "0.6rem",
                      backgroundColor: "#fff0f0",
                      border: "1px solid #ffcccc",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <strong>Track {trackId}</strong>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                      Position: ({person.x_m.toFixed(2)}m, {person.y_m.toFixed(2)}m)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Placed Cameras Panel */}
          <div className="page__section">
            <h3 className="page__section-title">Placed Cameras</h3>
            {cameras.filter((camera) => camera.placed).length === 0 ? (
              <p style={{ color: "var(--color-muted)", fontStyle: "italic", margin: 0 }}>No cameras placed</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {cameras
                  .filter((camera) => camera.placed)
                  .map((camera) => (
                    <div
                      key={camera.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.6rem",
                        backgroundColor: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                      }}
                    >
                      <div style={{ fontSize: "0.9rem" }}>
                        <strong>Camera {camera.id}</strong>
                        <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
                          ({camera.x.toFixed(2)}, {camera.y.toFixed(2)})
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveCamera(camera.id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "0.8rem",
                          backgroundColor: "#ff4d4d",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Available Cameras Panel */}
<div className="page__section">
  <h3 className="page__section-title">Available Cameras</h3>
  <p className="page__section-subtitle">Drag cameras to place them on the floormap edges or set coordinates</p>
  {cameras.filter((camera) => !camera.placed).length === 0 ? (
    <p style={{ color: "var(--color-muted)", fontStyle: "italic", margin: 0 }}>All cameras placed</p>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {cameras
        .filter((camera) => !camera.placed)
        .sort((a, b) => a.id - b.id)
        .map((camera) => (
          <div
            key={camera.id}
            style={{
              padding: "1rem",
              background: "var(--color-surface)",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{camera.name || `Camera ${camera.id}`}</strong>
              </div>
              <button
                draggable
                onDragStart={(e) => {
                  console.log(`Dragging camera with ID: ${camera.id}`);
                  e.dataTransfer.setData("cameraId", camera.id);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#2563eb",
                  color: "white",
                  borderRadius: "8px",
                  cursor: "grab",
                  fontWeight: "600",
                  border: "none",
                }}
              >
                Drag
              </button>
            </div>

            {/* Form for setting coordinates */}
            <form
  onSubmit={(e) => {
    e.preventDefault();

    const x = parseFloat(camera.newX);
    const y = parseFloat(camera.newY);

    // Validera att koordinaterna är på rummets kanter
    const isOnEdge =
      (x === 0 || x === roomConfig.width) || // Vänster eller höger kant
      (y === 0 || y === roomConfig.depth);   // Nedre eller övre kant

    if (!isOnEdge) {
      alert("Cameras can only be placed on the edges of the room!");
      return;
    }

    // Uppdatera kamerans position
    if (x >= 0 && x <= roomConfig.width && y >= 0 && y <= roomConfig.depth) {
      setCameras((prevCameras) =>
        prevCameras.map((cam) =>
          cam.id === camera.id ? { ...cam, x, y, placed: true } : cam
        )
      );
      console.log(`Camera ${camera.id} placed at (${x}, ${y})`);
    } else {
      alert("Coordinates must be within the room dimensions!");
    }
  }}
  style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}
>
  <input
    type="number"
    placeholder="X"
    value={camera.newX || ""}
    onChange={(e) =>
      setCameras((prevCameras) =>
        prevCameras.map((cam) =>
          cam.id === camera.id ? { ...cam, newX: e.target.value } : cam
        )
      )
    }
    style={{
      width: "4rem",
      padding: "0.5rem",
      borderRadius: "4px",
      border: "1px solid var(--color-border)",
    }}
  />
  <input
    type="number"
    placeholder="Y"
    value={camera.newY || ""}
    onChange={(e) =>
      setCameras((prevCameras) =>
        prevCameras.map((cam) =>
          cam.id === camera.id ? { ...cam, newY: e.target.value } : cam
        )
      )
    }
    style={{
      width: "4rem",
      padding: "0.5rem",
      borderRadius: "4px",
      border: "1px solid var(--color-border)",
    }}
  />
  <button
    type="submit"
    style={{
      padding: "0.5rem 1rem",
      backgroundColor: "#4CAF50",
      color: "white",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      fontWeight: "600",
    }}
  >
    Set
  </button>
</form>
          </div>
        ))}
    </div>
  )}
</div>
        </aside>

        {/*Floormap*/}
        <div className="page__section" style={{ padding: "2rem", minHeight: "700px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h3 className="page__section-title" style={{ margin: 0 }}>Floormap View</h3>
              <p className="page__section-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
                {roomConfig.width}m × {roomConfig.depth}m
              </p>
            </div>
          </div>
            
          
          {/* The Floormap Container */}
          <div
            style={{
              position: "relative",
              width: "100%",
              paddingBottom: `${(roomConfig.depth / roomConfig.width) * 100}%`,
              maxWidth: "100%",
              border: highlightEdges ? "3px solid #007bff" : "2px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              borderRadius: "12px",
              boxShadow: highlightEdges
                ? "inset 0px 0px 20px 4px rgba(0, 123, 255, 0.3)"
                : "inset 0 2px 8px rgba(15, 23, 42, 0.05)",
              transition: "all 0.3s ease",
              overflow: "hidden",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;

              const isOnEdge =
                x <= 15 ||
                x >= rect.width - 15 ||
                y <= 15 ||
                y >= rect.height - 15;

              setHighlightEdges(isOnEdge);
            }}
            onDragLeave={() => setHighlightEdges(false)}
            onDrop={(e) => {
              setHighlightEdges(false);
              const cameraId = parseInt(e.dataTransfer.getData("cameraId"), 10);
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;

              const isOnEdge =
                x <= 15 ||
                x >= rect.width - 15 ||
                y <= 15 ||
                y >= rect.height - 15;

              if (isOnEdge) {
                let normalizedX = (x / rect.width) * roomConfig.width;
                let normalizedY = roomConfig.depth - (y / rect.height) * roomConfig.depth;

                if (x <= 15) normalizedX = 0;
                if (x >= rect.width - 15) normalizedX = roomConfig.width;
                if (y <= 15) normalizedY = roomConfig.depth;
                if (y >= rect.height - 15) normalizedY = 0;

                handleDropCamera(cameraId, normalizedX, normalizedY);
              } else {
                alert("Camera must be placed on the edge!");
              }
            }}
          >
            {/* Absolute positioned content */}
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
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
                      transform: "translate(-50%, 50%)",
                      width: "14px",
                      height: "14px",
                      backgroundColor: "#2563eb",
                      borderRadius: "50%",
                      boxShadow: "0 0 8px rgba(37, 99, 235, 0.8)",
                      border: "2px solid white",
                    }}
                    title={`Camera ${camera.id}`}
                  />
                ))}

              {/* Render people as red circles */}
              {Object.entries(people).map(([trackId, person]) => (
                <div
                  key={trackId}
                  style={{
                    position: "absolute",
                    left: `${(person.x_m / roomConfig.width) * 100}%`,
                    bottom: `${(person.y_m / roomConfig.depth) * 100}%`,
                    transform: "translate(-50%, 50%)",
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#ef4444",
                    borderRadius: "50%",
                    boxShadow: "0 0 10px rgba(239, 68, 68, 0.8)",
                    border: "2px solid white",
                    animation: "pulse 2s infinite",
                  }}
                  title={`Track ID: ${trackId}`}
                />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "2rem", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: "12px", height: "12px", backgroundColor: "#2563eb", borderRadius: "50%", border: "2px solid white" }}></div>
              <span style={{ fontSize: "0.9rem", color: "var(--color-text)" }}>Cameras</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: "12px", height: "12px", backgroundColor: "#ef4444", borderRadius: "50%", border: "2px solid white" }}></div>
              <span style={{ fontSize: "0.9rem", color: "var(--color-text)" }}>People</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export default Floormap2D;
