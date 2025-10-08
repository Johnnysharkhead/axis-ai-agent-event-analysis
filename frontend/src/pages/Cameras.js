import React from "react";
import "../styles/pages.css";

function Cameras({ camera }) {
  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Cameras</h1>
        <p className="subtitle">Overview of Camera {camera} will be created here :)</p>
        <p>And then maybe a separate tab for each individual camera?</p>
      </header>

      <div className="page__placeholder-stack">
        <div className="page__placeholder page__placeholder--xlarge page__placeholder--camera">
          Camera {camera}
        </div>
      </div>
    </section>
  );
}

export default Cameras;
