import React, { useState, useEffect } from "react";
import "../styles/pages.css";
import RoomConfiguration from "../components/RoomConfiguration";

function Floormap2D() {
  const [roomConfig, setRoomConfig] = useState({ width: 10, depth: 10, cameraHeight: 2 });
  const [isConfigVisible, setIsConfigVisible] = useState(true);
  const [cameras, setCameras] = useState([]);
  const [highlightEdges, setHighlightEdges] = useState(false);
  const [firstCameraPlaced, setFirstCameraPlaced] = useState(false);
  const [floorplans, setFloorplans] = useState([]);
  const [selectedFloorplan, setSelectedFloorplan] = useState(null);
  // NEW: Track people on floormap - key is track_id, value is {x_m, y_m, lastSeen}
  const [people, setPeople] = useState({});
  // NEW: Toggle between real camera stream and mock test stream
  const [useMockStream, setUseMockStream] = useState(false);

  // NEW: Connect to real-time position stream and update people positions
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

  <div style={{ marginBottom: "1rem" }}>
  <label htmlFor="floorplanSelect">Select Floorplan: </label>
  <select
    id="floorplanSelect"
    value={selectedFloorplan?.id || ""}
    onChange={(e) => {
      const floorplan = floorplans.find(fp => fp.id === parseInt(e.target.value));
      setSelectedFloorplan(floorplan);
      if (floorplan) {
        setRoomConfig({
          width: floorplan.width,
          depth: floorplan.depth,
          cameraHeight: floorplan.camera_height || 2,
          name: floorplan.name,
          new_floorplan_id: floorplan.id
        });
        fetchCameras();
        // Mark cameras as placed if they have coordinates
        if (floorplan.cameras) {
          const camerasFromFloorplan = floorplan.cameras.map((camera) => ({
            ...camera,
            x: camera.placed_coords ? camera.placed_coords[0] : null,
            y: camera.placed_coords ? camera.placed_coords[1] : null,
            placed: !!camera.placed_coords
          }));
          setCameras(camerasFromFloorplan);
        }
      }
    }}
  >
    <option value="">-- Select a floorplan --</option>
    {floorplans.map((fp) => (
      <option key={fp.id} value={fp.id}>
        {fp.name}
      </option>
    ))}
  </select>
</div>


  const handleFetchFloorplans = () => {
    fetch("http://localhost:5001/floorplan", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.floorplans) {
          console.log("Fetched floorplans:", data.floorplans);
          setFloorplans(data.floorplans); // Spara floorplans i state
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
          setRoomConfig({ width, depth, cameraHeight: camera_height }); // Uppdatera roomConfig
          setCameras(
            cameras.map((camera) => ({
              ...camera,
              placed: true, // Markera kameror som placerade
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
  
      {/* Dropdown-meny för att välja en floorplan */}
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="floorplan-select" style={{ marginRight: "0.5rem" }}>
          Select a Floorplan:
        </label>
        <select
          id="floorplan-select"
          value={selectedFloorplan?.id || ""}
          onChange={(e) => {
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

              // Store pre-placed camera if it exists
              let prePlacedCamera = null;
              if (
                floorplan.camera_floorplancoordinates &&
                Array.isArray(floorplan.camera_floorplancoordinates)
              ) {
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

              // Always fetch cameras, and merge with pre-placed if needed
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
                  // Merge pre-placed camera if it exists and not already in fetched

                  const placedCameraIds = [];
                  if (prePlacedCamera && prePlacedCamera.id !== "virtual") {
                    placedCameraIds.push(prePlacedCamera.id);
                  }
                  if (floorplan.cameras && Array.isArray(floorplan.cameras)) {
                    floorplan.cameras.forEach(cam => {
                      if (cam.id !== undefined && cam.id !== null) placedCameraIds.push(cam.id);
                    });
                  }

                  // Filter out cameras that are already placed
                  const filteredCameras = fetchedCameras.filter(
                    (camera) => !placedCameraIds.includes(camera.id)
                  );

                  // Merge pre-placed camera if it exists
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
          }}
          style={{
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            cursor: "pointer",
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
  
      
      {/* Toggle Mock Stream for Testing */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem" }}>
        <button
          onClick={() => setIsConfigVisible(!isConfigVisible)}
          style={{
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

        <button
          onClick={() => {
            setUseMockStream(!useMockStream);
            setPeople({}); // Clear people when switching streams
          }}
          style={{
            padding: "0.3rem 0.8rem",
            backgroundColor: useMockStream ? "#4CAF50" : "#ff9800",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: "bold",
          }}
        >
          {useMockStream ? "Using MOCK Stream (Testing)" : "Using REAL Stream (Camera)"}
        </button>
      </div>
  
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
                transform: "translate(-50%, 50%)",
                width: "10px",
                height: "10px",
                backgroundColor: "blue",
                borderRadius: "50%",
                boxShadow: "0 0 5px rgba(0, 0, 255, 0.8)",
              }}
            />
          ))}

        {/*Render people as red circles */}
        {Object.entries(people).map(([trackId, person]) => (
          <div
            key={trackId}
            style={{
              position: "absolute",
              left: `${(person.x_m / roomConfig.width) * 100}%`,
              bottom: `${(person.y_m / roomConfig.depth) * 100}%`,
              transform: "translate(-50%, 50%)",
              width: "8px",
              height: "8px",
              backgroundColor: "red",
              borderRadius: "50%",
              boxShadow: "0 0 5px rgba(255, 0, 0, 0.8)",
            }}
            title={`Track ID: ${trackId}`}
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

      {/* NEW: Control Panel for Active People */}
      <div style={{ marginTop: "1rem" }}>
        <h3>Active People ({Object.keys(people).length})</h3>
        {Object.keys(people).length === 0 ? (
          <p style={{ color: "#999", fontStyle: "italic" }}>No people detected</p>
        ) : (
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {Object.entries(people).map(([trackId, person]) => (
              <li
                key={trackId}
                style={{
                  marginBottom: "0.5rem",
                  padding: "0.5rem",
                  backgroundColor: "#fff0f0",
                  border: "1px solid #ffcccc",
                  borderRadius: "4px",
                }}
              >
                <span>
                  Track ID: {trackId} - Position: ({person.x_m.toFixed(2)}m, {person.y_m.toFixed(2)}m)
                </span>
              </li>
            ))}
          </ul>
        )}
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
