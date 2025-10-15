/**
*A button to toggle a painting color on/off and which one should be active
* AUTHORS: Astrix Karlsson
*/
import React from "react";
import Button from "./Button";
// ColorButton: A button that toggles a painting color on/off
function ColorButton({
  paintingColor = "red",
  buttonColorSelected,
  currentColor,
  onChange,
  activeText = "Paint",
}) {
  const isActive = currentColor === paintingColor;
  // Toggle painting color on click
  const togglePainting = () => {
    onChange?.(isActive ? null : paintingColor); // turn off if already active
  };
  // Style button differently if active
  return (
    <div style={{ marginTop: 8 }}>
      <Button
        text={activeText}
        onClick={togglePainting}
        style={{
          backgroundColor: isActive ? buttonColorSelected : "#f0f0f0",
          color: isActive ? "#fff" : "#000",
          border: isActive
            ? `2px solid ${buttonColorSelected}`
            : "2px solid #ccc",
          boxShadow: isActive
            ? "inset 2px 2px 6px rgba(0, 0, 0, 0.3)"
            : "2px 2px 4px rgba(0, 0, 0, 0.1)",
          transform: isActive ? "translateY(2px)" : "none",
          transition: "all 0.15s ease-in-out",
          padding: "0.5rem 1rem",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: isActive ? "bold" : "normal",
        }}
      >
        {isActive ? "Active" : "Select"}
      </Button>
    </div>
  );
}

export default ColorButton;
