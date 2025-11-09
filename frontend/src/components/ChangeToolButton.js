/**
 * ChangeToolButton.js
 * Button to toggle between painting and dragging modes in the gridmap.
 * AUTHORS: Astrix Karlsson
 * currentTool can be:
 *  - "paint" → painting cells
 *  - "drag"  → dragging/selection mode
*/

import React from "react";

function ChangeToolButton({ currentTool, onChange }) {

    const toggleTool = () => {
        if (currentTool === "paint") onChange("drag");
        else onChange("paint");
    };

    const isPaint = currentTool === "paint";
    const displayText = isPaint ? "Painting Mode" : "Dragging Mode";

    return (
        <button
            type="button"
            onClick={toggleTool}
            className={`page__control floormap-control${
                isPaint ? " floormap-control--active" : " floormap-control--drag"
            }`}
        >
            {displayText}
        </button>
    );
}

export default ChangeToolButton;
