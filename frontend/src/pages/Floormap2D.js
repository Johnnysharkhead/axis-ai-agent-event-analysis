import React from "react";
import MainLayout from "../layouts/MainLayout";
import "../styles/pages.css";

function Floormap2D() {
  return (
    <MainLayout>
      <section className="page">
        <header className="header">
          <h1 className="title">Floormap 2D</h1>
          <p className="subtitle">Overview of the 2D floormap will be created here :)</p>
          <p>And then maybe seperate tabs for defining zones, heatmaps, alarms etc. Or per camera?</p>
        </header>

        <div className="page__placeholder-stack">
          <div className="page__placeholder page__placeholder--xlarge page__placeholder--floormap">2D map canvas</div>
          <div className="page__placeholder page__placeholder--large page__placeholder--floormap">Context panels / tools</div>
        </div>
      </section>
    </MainLayout>
  );
}

export default Floormap2D;
