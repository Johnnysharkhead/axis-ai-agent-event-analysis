/**
 * ChangeToolButton.js
 * Button to toggle between painting and dragging modes in the gridmap.
 * AUTHORS: Astrix Karlsson
 * currentTool can be:
 *  - "paint" → painting cells
 *  - "drag"  → dragging/selection mode
*/

import React from "react";
import Button from "./Button";

function ChangeToolButton({ currentTool, onChange }) {

    const toggleTool = () => {
        if (currentTool === "paint") onChange("drag");
        else onChange("paint");
    };

    const displayText = currentTool === "paint" ? "Painting Mode" : "Dragging Mode";

    const backgroundColor = currentTool === "paint" ? "#3b79ce" : "#696969";

    return (
        <div style={{ marginTop: 8 }}>
            <Button
                text={displayText}
                onClick={toggleTool}
                style={{
                    backgroundColor,
                    color: "#fff",
                    border: `2px solid ${backgroundColor}`,
                    borderRadius: "6px",
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    fontWeight: "bold",
                }}
            />
        </div>
    );
}

export default ChangeToolButton;