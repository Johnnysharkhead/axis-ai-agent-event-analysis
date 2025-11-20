import React, { useState, useEffect } from "react";
import "../styles/pages.css";
import Gridmap from "../components/Gridmap";
import ColorButton from "../components/ColorButton";
import ChangeToolButton from "../components/ChangeToolButton";
import ScheduleAlarms from "./ScheduleAlarms";
import RoomConfiguration from "../components/RoomConfiguration";
import "../styles/Floormap2D.css";



function Floormap2D() {
  const [roomConfig, setRoomConfig] = useState({ width: 10, depth: 10});
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
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Floorplan POST response:", data);
        newConfig.new_floorplan_id = data.new_floorplan_id;
        fetchCameras();

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

  // If the view is schedule-alarms, render only the ScheduleAlarms component
  if (view === "schedule-alarms") {
    return <ScheduleAlarms embedded />;
  }

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
              <label htmlFor="floorplan-select" className="floorplan-select-label">
                Select a Floorplan
              </label>
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

          {/* Room Configuration Toggle */}
          <div className="page__section">
            <button
              onClick={() => setIsConfigVisible(!isConfigVisible)}
              className="page__control room-config-toggle"
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
            <h3 className="page__section-title available-cameras-title">Available Cameras</h3>
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
            style={{
              "--floormap-padding-bottom": `${(roomConfig.depth / roomConfig.width) * 100}%`,
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

                // Skicka uppdaterad position till servern
                fetch(`http://localhost:5001/floorplan/${roomConfig.id}/update-camera`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    cameraId,
                    x: normalizedX,
                    y: normalizedY,
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
                    // Uppdatera kamerans position i klienten
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
            {/* Absolute positioned content */}
            <div className="floormap-content">
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
