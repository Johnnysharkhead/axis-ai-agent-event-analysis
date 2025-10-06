import React from "react";
import MainLayout from "../layouts/MainLayout";
import "../styles/pages.css";

function Cameras() {
  return (
    <MainLayout>
      <section className="page">
        <header className="header">
          <h1 className="title">Cameras</h1>
          <p className="subtitle">Overview of the cameras will be created here :)</p>
          <p>And then maybe a seperate tab for each individual camera?</p>
        </header>

        <div className="page__placeholder-row">
          <div className="page__placeholder page__placeholder--large page__placeholder--camera">Camera 1</div>
          <div className="page__placeholder page__placeholder--large page__placeholder--camera">Camera 2</div>
          <div className="page__placeholder page__placeholder--large page__placeholder--camera">Camera 3</div>
        </div>
      </section>
    </MainLayout>
  );
}

export default Cameras;
