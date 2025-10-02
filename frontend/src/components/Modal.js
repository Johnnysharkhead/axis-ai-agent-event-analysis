import React from "react";

export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{ background: "#fff", padding: 20, borderRadius: 8, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10 }}>Close</button>
        {children}
      </div>
    </div>
  );
}