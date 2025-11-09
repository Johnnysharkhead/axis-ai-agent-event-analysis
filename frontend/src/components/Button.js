/**
 * Reusable Button component.
 * We can use <Button text="Click me" /> anywhere in the app.
 */

import React from "react";

function Button({ text, onClick, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
        color: "#f8fafc",
        padding: "0.5rem 1.15rem",
        border: "none",
        borderRadius: "999px",
        cursor: "pointer",
        fontWeight: 600,
        boxShadow: "0 12px 24px rgba(37, 99, 235, 0.25)",
        transition: "transform 0.15s ease, box-shadow 0.2s ease",
        ...style, // <-- merge parent-provided styles last (so they override defaults)
      }}
    >
      {text}
    </button>
  );
}

export default Button;
