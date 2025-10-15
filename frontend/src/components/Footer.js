/**
 * This is a reusable component (Footer).
 * Components = small UI building blocks that can be used across multiple pages.
 */

import React from "react";

function Footer() {
  return (
    <footer style={{
      background: "#eee",
      padding: "1rem",
      left: 0,
      bottom: 0,
      width: "100%"
    }}>
      <p>© 2025 Axis Project</p>
    </footer>
  );
}

export default Footer;
