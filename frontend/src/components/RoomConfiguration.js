import React, { useState } from "react";

function RoomConfiguration({ onSave }) {
  const [roomName, setRoomName] = useState(""); 
  const [roomWidth, setRoomWidth] = useState("");
  const [roomDepth, setRoomDepth] = useState("");
  const [cameraHeight, setCameraHeight] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: roomName,
      width: parseFloat(roomWidth),
      depth: parseFloat(roomDepth),
      cameraHeight: parseFloat(cameraHeight),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <label>
        Room Name/Description:
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Enter room name or description"
          required
          style={{
            padding: "0.3rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "0.9rem",
          }}
        />
      </label>
      <label>
        Room Width (meters):
        <input
          type="number"
          value={roomWidth}
          onChange={(e) => setRoomWidth(e.target.value)}
          placeholder="Enter room width"
          required
          style={{
            padding: "0.3rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "0.9rem",
          }}
        />
      </label>
      <label>
        Room Depth (meters):
        <input
          type="number"
          value={roomDepth}
          onChange={(e) => setRoomDepth(e.target.value)}
          placeholder="Enter room depth"
          required
          style={{
            padding: "0.3rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "0.9rem",
          }}
        />
      </label>
      <label>
        Camera Height (meters):
        <input
          type="number"
          value={cameraHeight}
          onChange={(e) => setCameraHeight(e.target.value)}
          placeholder="Enter camera height"
          required
          style={{
            padding: "0.3rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "0.9rem",
          }}
        />
      </label>
      <button
        type="submit"
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
        Save Room Configuration
      </button>
    </form>
  );
}

export default RoomConfiguration;