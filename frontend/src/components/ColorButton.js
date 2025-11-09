/**
*A button to toggle a painting color on/off and which one should be active
* AUTHORS: Astrix Karlsson
*/
import React from "react";
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
  const indicatorStyle = {
    backgroundColor: isActive ? buttonColorSelected || "#2563eb" : "#cbd5f5",
  };

  return (
    <button
      type="button"
      onClick={togglePainting}
      className={`page__control floormap-control${isActive ? " floormap-control--active" : ""}`}
    >
      <span className="floormap-control__indicator" style={indicatorStyle} aria-hidden />
      <span>{activeText}</span>
    </button>
  );
}

export default ColorButton;
