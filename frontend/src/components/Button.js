/**
 * Reusable Button component.
 * We can use <Button text="Click me" /> anywhere in the app.
 */

import React from "react";

function Button({ text, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#e2c11aff",
        color: "white",
        padding: "0.5rem 1rem",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      {text}
    </button>
  );
}

export default Button;