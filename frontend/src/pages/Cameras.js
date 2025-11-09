import React from "react";
import "../styles/pages.css";

function Cameras({ camera }) {
  return (
    <section className="page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Cameras</h1>
          <p className="subtitle">Overview of Camera {camera} will be created here :)</p>
          <p>And then maybe a separate tab for each individual camera?</p>
        </header>

        <div className="page__controls">
          <button type="button" className="page__control page__control--primary">
            Add camera
          </button>
          <button type="button" className="page__control">
            Manage presets
          </button>
        </div>
      </div>

      <div className="page__section">
        <div className="page__placeholder-stack">
          <div className="page__placeholder page__placeholder--xlarge page__placeholder--camera">
            Camera {camera}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Cameras;
