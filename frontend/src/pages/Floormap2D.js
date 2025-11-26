import React, { useState, useEffect, useRef } from "react";
import "../styles/pages.css";
import RoomConfiguration from "../components/RoomConfiguration";
import HeatmapOverlay from "../components/HeatmapOverlay";
import "../styles/Floormap2D.css";
import { usePersistedFloorplan, getCachedFloorplans, cacheFloorplans, invalidateFloorplanCache } from "../utils/floorplanPersistence";



function Floormap2D() {
  const [persistedId, savePersistedId] = usePersistedFloorplan();
  const [roomConfig, setRoomConfig] = useState({ width: 10, depth: 10 });
  const [isConfigVisible, setIsConfigVisible] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [highlightEdges, setHighlightEdges] = useState(false);
  const [firstCameraPlaced, setFirstCameraPlaced] = useState(false);
  const [floorplans, setFloorplans] = useState([]);
  const [selectedFloorplan, setSelectedFloorplan] = useState(null);
  const [people, setPeople] = useState({});
  const [useMockStream, setUseMockStream] = useState(false);
  const [newCamera, setNewCamera] = useState({ x: "", y: "" });
  const [mapHeight, setMapHeight] = useState(400);
  const [isAvailableCamerasVisible, setIsAvailableCamerasVisible] = useState(false);
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [heatmapDuration, setHeatmapDuration] = useState(600);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    const containerWidth = Math.min(window.innerWidth * 0.6, 800); // exempel på maxbredd
    const height = (roomConfig.depth / roomConfig.width) * containerWidth;
    setMapHeight(height);
  }, [roomConfig]);

  useEffect(() => {

    const streamUrl = useMockStream
      ? 'http://localhost:5001/test/mock-stream' //Connect to testing stream
      : 'http://localhost:5001/stream/positions'; //Connect to position REAL positon stream

    const eventSource = new EventSource(streamUrl);
    console.log(`Connected to ${useMockStream ? 'MOCK' : 'REAL'} position stream`);

    eventSource.onmessage = (e) => {
      const pos = JSON.parse(e.data);
      // console.log('Position update:', pos);

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
          if (now - updated[trackId].lastSeen > 3000) {
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
    if (persistedId && floorplans.length > 0 && !selectedFloorplan) {
      //instantly update the dropdown text
      const floorplan = floorplans.find(fp => fp.id === persistedId);
      if (floorplan) {
        setSelectedFloorplan(floorplan);
        //load the full details in the background
        setTimeout(() => {
          const event = { target: { value: String(persistedId) } };
          handleSelectFloorplanChange(event);
        }, 0);
      }
    }
  }, [persistedId, floorplans]);

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
    //Try cache first
    const cached = getCachedFloorplans();
    if (cached) {
      setFloorplans(cached);
      return;
    }

    //Cache miss, fetch from backend
    fetch("http://localhost:5001/floorplan", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.floorplans) {
          console.log("Fetched floorplans:", data.floorplans);
          setFloorplans(data.floorplans);
          cacheFloorplans(data.floorplans);
        } else {
          console.error("No floorplans found in the database.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch floorplans:", err);
      });
  };


  useEffect(() => {
    handleFetchFloorplans();
  }, []);


  const handleAutoScroll = (e) => {
    const scrollMargin = 50; 
    const scrollSpeed = 10; 
  
    if (e.clientY < scrollMargin) {
      window.scrollBy(0, -scrollSpeed);
    } else if (e.clientY > window.innerHeight - scrollMargin) {
      window.scrollBy(0, scrollSpeed);
    }
  };

  const handleSaveConfig = (newConfig) => {
    setRoomConfig(newConfig);
    fetch("http://localhost:5001/floorplan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        floorplan_name: newConfig.name,
        floorplan_width: newConfig.width,
        floorplan_depth: newConfig.depth,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Floorplan POST response:", data);
        newConfig.new_floorplan_id = data.new_floorplan_id;
        fetchCameras();
        setZones([]);
        invalidateFloorplanCache(); // Clear cache so new floorplan appears

        fetch(`http://localhost:5001/floorplan/${data.new_floorplan_id}`)
          .then((res) => res.json())
          .then((floorplanData) => {
            if (floorplanData.floorplan) {
              setSelectedFloorplan(floorplanData.floorplan);
              setRoomConfig({
                width: floorplanData.floorplan.width,
                depth: floorplanData.floorplan.depth,
                name: floorplanData.floorplan.name,
                new_floorplan_id: floorplanData.floorplan.id,
              });
            }
          });
      })
      .catch((err) => {
        console.error("Failed to add floorplan:", err);
      });
    console.log("Room Configuration Saved:", newConfig);
  };

  const handleRemoveCamera = (cameraId) => {
    const confirmRemove = window.confirm("Are you sure you want to remove this camera?");
    if (confirmRemove) {
      console.log(cameraId)
      console.log(selectedFloorplan)
      fetch(`http://localhost:5001/floorplan/${selectedFloorplan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_id: cameraId
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Camera successfully removed from floorplan in backend.");
        })
        .catch((err) => {
          console.error("Failed to remove camera from floorplan in backend", err);
        });

      setCameras((prevCameras) =>
        prevCameras.map((camera) =>
          camera.id === cameraId ? { ...camera, x: null, y: null, placed: false } : camera
        )
      );
      console.log(`Camera ${cameraId} removed from the map`);
    }
  };

  const handleSelectFloorplanChange = (e) => {
    const floorplanId = parseInt(e.target.value);
    if (!floorplanId) return;

    savePersistedId(floorplanId);

    fetch(`http://localhost:5001/floorplan/${floorplanId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data)
        if (data.floorplan) {
          const floorplan = data.floorplan;
          setSelectedFloorplan(floorplan);
          setRoomConfig({
            width: floorplan.width,
            depth: floorplan.depth,
            name: floorplan.name,
            new_floorplan_id: floorplan.id,
          });
          console.log(floorplan.zones)
          if (floorplan.zones) {
            const zoneData = floorplan.zones;
            const zoneList = Array.isArray(zoneData) ? zoneData : zoneData.zones || [];
            setZones(zoneList);
          } else {
            setZones([])
          }

          // Fetch all cameras and set their placed status and coordinates
          fetch("http://localhost:5001/cameras")
            .then((res) => res.json())
            .then((camData) => {
              console.log(camData)
              let fetchedCameras = [];
              if (camData.cameras) {
                fetchedCameras = camData.cameras.map((camera) => {
                  let placed = false;
                  let x = null;
                  let y = null;
                  if (
                    floorplan.camera_floorplancoordinates &&
                    floorplan.camera_floorplancoordinates[String(camera.id)]
                  ) {
                    placed = true;
                    [x, y] = floorplan.camera_floorplancoordinates[String(camera.id)];
                  }
                  return {
                    ...camera,
                    x,
                    y,
                    placed,
                  };
                });
              }
              setCameras(fetchedCameras);
            })
            .catch((err) => {
              console.error("Failed to fetch cameras:", err);
            });
        } else {
          setSelectedFloorplan(null);
          setCameras([]);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch floorplan:", err);
        setSelectedFloorplan(null);
        setCameras([]);
      });
  };

  const handleDeleteFloorplan = (floorplanId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this floorplan?");
    if (confirmDelete) {
      fetch(`http://localhost:5001/floorplan/${floorplanId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to delete floorplan with status ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          console.log("Floorplan deleted successfully:", data);
          invalidateFloorplanCache(); // Clear cache so deleted floorplan disappears
          // Uppdatera listan med floorplans
          setFloorplans((prevFloorplans) =>
            prevFloorplans.filter((fp) => fp.id !== floorplanId)
          );
          setSelectedFloorplan(null); // Återställ vald floorplan
          window.location.reload();
        })
        .catch((err) => {
          console.error("Failed to delete floorplan:", err);
        });
    }
  };

  function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 0.0000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

useEffect(() => {
  Object.entries(people).forEach(([trackId, person]) => {
    zones.forEach((zone) => {
      if (
        zone.points &&
        pointInPolygon({ x: person.x_m, y: person.y_m }, zone.points)
      ) {
        console.log(`Intrusion detected! Person ${trackId} entered zone "${zone.name}"`);
        // You can trigger other actions here (alert, API call, etc)
      }
    });
  });
}, [people, zones]);

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
              <select
                id="floorplan-select"
                value={selectedFloorplan?.id || ""}
                onChange={handleSelectFloorplanChange}
                className="floorplan-select"
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
              className={`stream-settings-button ${useMockStream ? "mock" : "real"}`}
            >
              {useMockStream ? "Using MOCK Stream" : "Using REAL Stream"}
            </button>
            <small className="stream-settings-info">
              {useMockStream ? "Test mode: Simulated people movement" : "Live mode: Real camera data"}
            </small>
          </div>

          {/* Room Configuration */}
          <div className="page__section">
          <button
          onClick={() => setIsConfigVisible(!isConfigVisible)}
          className="page__control room-config-toggle"
          >
          {isConfigVisible ? "Hide" : "Show"} Room Configuration
          </button>

          {isConfigVisible && (
          <>
          <h3 className="page__section-title">Room Configuration</h3>
          <RoomConfiguration onSave={handleSaveConfig} />
          </>
          )}
          </div>


          {/* Active People Panel */}
          <div className="page__section active-people">
            <h3 className="page__section-title active-people-title">
              Active People ({Object.keys(people).length})
            </h3>
            {Object.keys(people).length === 0 ? (
              <p className="active-people-empty">No people detected</p>
            ) : (
              <div className="active-people-list">
                {Object.entries(people).map(([trackId, person]) => (
                  <div key={trackId} className="active-people-item">
                    <strong className="active-people-item-title">Track {trackId}</strong>
                    <div className="active-people-item-position">
                      Position: ({person.x_m.toFixed(2)}m, {person.y_m.toFixed(2)}m)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Placed Cameras Panel */}
          <div className="page__section placed-cameras">
            <h3 className="page__section-title placed-cameras-title">Placed Cameras</h3>
            {cameras.filter((camera) => camera.placed).length === 0 ? (
              <p className="placed-cameras-empty">No cameras placed</p>
            ) : (
              <div className="placed-cameras-list">
                {cameras
                  .filter((camera) => camera.placed)
                  .map((camera) => (
                    <div key={camera.id} className="placed-camera-item">
                      <div className="placed-camera-info">
                        <strong>Camera {camera.id}</strong>
                        <div className="placed-camera-coordinates">
                          ({camera.x.toFixed(2)}, {camera.y.toFixed(2)})
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          console.log(camera.id)
                          handleRemoveCamera(camera.id)
                        }
                        }
                        className="placed-camera-remove-button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Available Cameras Panel */}
          <div className="page__section available-cameras">
            <h3
              className="page__section-title available-cameras-title"
              onClick={() => setIsAvailableCamerasVisible(!isAvailableCamerasVisible)}
              style={{ cursor: "pointer" }}
            >
              Available Cameras
              <span style={{ marginLeft: "10px" }}>
                {isAvailableCamerasVisible ? "▼" : "▲"}
              </span>
            </h3>
            {isAvailableCamerasVisible && (
              <>
                <p className="available-cameras-subtitle">
                  Drag cameras to place them on the floormap edges or set coordinates
                </p>
                {cameras.filter((camera) => !camera.placed && (camera.floorplan_id === null || camera.floorplan_id === undefined)).length === 0 ? (
                  <p className="available-cameras-empty">All cameras placed</p>
                ) : (
                  <div className="available-cameras-list">
                    {cameras
                      .filter((camera) => !camera.placed && (camera.floorplan_id === null || camera.floorplan_id === undefined))
                      .sort((a, b) => a.id - b.id)
                      .map((camera) => (
                        <div key={camera.id} className="available-camera-item">
                          <div className="available-camera-item-header">
                            <div className="available-camera-item-title">
                              {camera.name || `Camera ${camera.id}`}
                            </div>
                            <button
                              draggable
                              onDragStart={(e) => {
                                console.log(`Dragging camera with ID: ${camera.id}`);
                                e.dataTransfer.setData("cameraId", camera.id);
                              }}
                              className="available-camera-drag-button"
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

                              // Make sure camera is placed on the edge
                              const isOnEdge =
                                (x === 0 || x === roomConfig.width) || // Left or right edge
                                (y === 0 || y === roomConfig.depth);   // Top or bottom edge

                              if (!isOnEdge) {
                                alert("Cameras can only be placed on the edges of the room!");
                                return;
                              }

                              // Update camera position if within room dimensions
                              if (x >= 0 && x <= roomConfig.width && y >= 0 && y <= roomConfig.depth) {
                                setCameras((prevCameras) =>
                                  prevCameras.map((cam) =>
                                    cam.id === camera.id ? { ...cam, x, y, placed: true } : cam
                                  )
                                );
                                console.log(`Camera ${camera.id} placed at (${x}, ${y})`);

                                fetch(`http://localhost:5001/floorplan/${roomConfig.new_floorplan_id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    camera_id: camera.id,
                                    placed_coords: [x, y],
                                  }),
                                })
                                  .then((res) => res.json())
                                  .then((data) => {
                                    console.log("Camera placement PUT response:", data);
                                  })
                                  .catch((err) => {
                                    console.error("Failed to update floorplan with camera:", err);
                                  });
                              } else {
                                alert("Coordinates must be within the room dimensions!");
                              }
                            }}
                            className="camera-coordinate-form"
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
                              className="camera-coordinate-input"
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
                              className="camera-coordinate-input"
                            />
                            <button type="submit" className="camera-coordinate-submit">
                              Set
                            </button>
                          </form>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Heatmap Panel */}
          <div className="page__section heatmap-panel">
            <h3
              className="page__section-title heatmap-panel-title"
              onClick={() => setIsHeatmapVisible(!isHeatmapVisible)}
            >
              Heatmap
              <span className="heatmap-panel-toggle">
                {isHeatmapVisible ? "▼" : "▲"}
              </span>
            </h3>
            {isHeatmapVisible && (
              <>
                <button
                  onClick={() => setHeatmapEnabled(!heatmapEnabled)}
                  className={`heatmap-toggle-button ${heatmapEnabled ? "enabled" : "disabled"}`}
                >
                  {heatmapEnabled ? "Hide Heatmap" : "Show Heatmap"}
                </button>

                {heatmapEnabled && (
                  <>
                    <div className="heatmap-control">
                      <label className="heatmap-control-label">Time Window</label>
                      <select
                        value={heatmapDuration}
                        onChange={(e) => setHeatmapDuration(parseInt(e.target.value))}
                        className="heatmap-duration-select"
                      >
                        <option value={300}>5 minutes</option>
                        <option value={600}>10 minutes</option>
                        <option value={1800}>30 minutes</option>
                        <option value={3600}>1 hour</option>
                        <option value={7200}>2 hours</option>
                        <option value={14400}>4 hours</option>
                      </select>
                    </div>

                    <button
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to clear all heatmap history?")) {
                          try {
                            const response = await fetch("http://localhost:5001/heatmap/clear", {
                              method: "DELETE",
                            });
                            const data = await response.json();
                            alert(`Cleared ${data.deleted_count || 0} position records`);
                          } catch (err) {
                            alert("Failed to clear heatmap data");
                          }
                        }
                      }}
                      className="heatmap-clear-button"
                    >
                      Clear History
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Floormap */}
        {selectedFloorplan && (
          <div className="page__section floormap-section">
            <div className="floormap-header">
              <div>
                <h3 className="page__section-title floormap-title">Floormap View - {roomConfig.name}</h3>
                <p className="page__section-subtitle floormap-subtitle">
                  {roomConfig.width}m × {roomConfig.depth}m
                </p>
              </div>
            </div>

            {/* Delete Floorplan Button */}
            {selectedFloorplan && (
              <button
                className="delete-floorplan-button"
                onClick={() => handleDeleteFloorplan(selectedFloorplan.id)}
              >
                Delete
              </button>
            )}

            {/* The Floormap Container */}
            <div
              className={`floormap-container ${highlightEdges ? "highlight" : ""}`}
              style={{ width: "100%", height: `${mapHeight}px`, position: "relative" }}

              onDragOver={(e) => {
                e.preventDefault();
                handleAutoScroll(e); // Lägg till automatisk scrollning
            
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
                e.preventDefault();
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
            
                  console.log(`Placing camera ${cameraId} at (${normalizedX}, ${normalizedY})`);
            
                  fetch(`http://localhost:5001/floorplan/${roomConfig.new_floorplan_id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      camera_id: cameraId,
                      placed_coords: [normalizedX, normalizedY],
                    }),
                  })
                    .then((res) => {
                      if (!res.ok) {
                        throw new Error(`Server responded with status ${res.status}`);
                      }
                      return res.json();
                    })
                    .then((data) => {
                      console.log("Camera updated successfully:", data);
                      setCameras((prevCameras) =>
                        prevCameras.map((camera) =>
                          camera.id === cameraId
                            ? { ...camera, x: normalizedX, y: normalizedY, placed: true }
                            : camera
                        )
                      );
                    })
                    .catch((err) => {
                      console.error("Failed to update camera position:", err);
                    });
                } else {
                  alert("Camera must be placed on the edge!");
                }
              }}
            >
              {/* Heatmap Overlay */}
              {heatmapEnabled && selectedFloorplan && (
                <HeatmapOverlay
                  duration={heatmapDuration}
                  floorplanWidth={roomConfig.width}
                  floorplanHeight={roomConfig.depth}
                  enabled={heatmapEnabled}
                />
              )}

              {/* Absolute positioned content */}
            <div className="floormap-content">
            <svg
              viewBox={`0 0 ${roomConfig.width} ${roomConfig.depth}`}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 1,
              }}
              preserveAspectRatio="none"
            >
              {/* Render zones as polygons */}
              {zones.map((zone, i) => (
                <polygon
                  key={zone.id}
                  points={
                    (zone.points || [])
                      .map((p) => `${p.x},${roomConfig.depth - p.y}`)
                      .join(" ")
                  }
                  fill={`hsl(${(i * 57) % 360} 75% 50% / 0.12)`}
                  stroke={`hsl(${(i * 57) % 360} 75% 35%)`}
                  strokeWidth={0.01 * roomConfig.width} // much thinner lines
                />
              ))}

              {/* Render zone names at centroid */}
              {zones.map((zone, i) =>
                zone.centroid ? (
                  <text
                    key={zone.id + "_label"}
                    x={zone.centroid?.x}
                    y={zone.centroid ? roomConfig.depth - zone.centroid.y : 0}
                    fontSize={0.18 * roomConfig.width}
                    textAnchor="middle"
                    fill={`hsl(${(i * 57) % 360} 75% 35%)`}
                    style={{ fontWeight: 700 }}
                  >
                    {zone.name}
                  </text>
                ) : null
              )}
            </svg>

            {/* Render cameras as blue circles */}
            {cameras
              .filter((camera) => camera.placed)
              .map((camera) => (
                <div
                  key={camera.id}
                  className="camera-circle"
                  style={{
                    left: `${(camera.x / roomConfig.width) * 100}%`,
                    bottom: `${(camera.y / roomConfig.depth) * 100}%`,
                  }}
                  title={`Camera ${camera.id}`}
                />
              ))}

            {/* Render people as red circles */}
            {Object.entries(people).map(([trackId, person]) => (
              <div
                key={trackId}
                className="person-circle"
                style={{
                  left: `${(person.x_m / roomConfig.width) * 100}%`,
                  bottom: `${(person.y_m / roomConfig.depth) * 100}%`,
                }}
                title={`Track ID: ${trackId}`}
              />
            ))}
          </div>
            </div>


            {/* Legend */}
            <div className="legend">
              <div className="legend-item">
                <div className="legend-circle cameras"></div>
                <span className="legend-text">Cameras</span>
              </div>
              <div className="legend-item">
                <div className="legend-circle people"></div>
                <span className="legend-text">People</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

export default Floormap2D;
