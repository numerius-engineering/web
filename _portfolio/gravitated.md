---
title: Gravitated
description: N-body gravity simulation with inelastic merging, rotating bodies, and an adaptive viewport, available in the browser and as an Android app.
permalink: /portfolio/gravitated/
thumbnail: /assets/portfolio/gravitated/gravitated-screenshot.png
tags:
  - Web app
  - Android
  - Physics
  - Simulation
featured: false
in_apps: true
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Gravitated</h1>
  <p class="lead">Gravitated is an interactive N-body gravity simulation that runs in the browser as a single HTML file and is also packaged as an Android app.</p>
</section>

<section class="section-grid">
  <article class="content-block">
    <h2>Project focus</h2>
    <p>Up to 12 bodies can be configured with position, velocity, angular momentum, radius, and density. Colliding bodies merge inelastically, and each body carries a visibly rotating surface texture. The viewport tracks the system centroid and auto-fits the scene, and simulation parameters such as time step, gravitational constant, and trail length can be tuned live.</p>
    <p>The same simulation is wrapped in an Android <code>WebView</code> app with a mobile-friendly controls sheet and a branded launcher icon.</p>
    <p><a href="{{ '/apps/gravitated.html' | relative_url }}">Launch the live browser app</a></p>
  </article>
  <article class="content-block">
    <h2>What it demonstrates</h2>
    <p>Gravitated demonstrates Numerius Engineering's ability to build physics simulations with an engaging interface and then carry a web app onto mobile: numerical integration, collision handling, responsive control design, and packaging for both browser and Android distribution.</p>
    <p><a href="{{ '/apps/' | relative_url }}">Browse the Apps gateway</a></p>
  </article>
</section>

<section class="section-block">
  <div class="section-heading">
    <p class="eyebrow">Highlights</p>
    <h2>Key capabilities from the delivered release.</h2>
  </div>
  <div class="gallery-grid">
    <article class="gallery-item">
      <img class="gallery-image" src="{{ '/assets/portfolio/gravitated/gravitated-screenshot.png' | relative_url }}" alt="Gravitated showing two orbiting bodies with per-body and simulation controls">
      <h2>Simulation and controls</h2>
      <p>Two bodies on their starting trajectories, with a live readout of mass, velocity, and angular momentum, and per-body and global parameter controls below.</p>
    </article>
  </div>
</section>
