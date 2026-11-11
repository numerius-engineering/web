---
title: Violet Mango
description: Browser-based 2.5D FDTD electromagnetic solver with CAD import, absorbing boundaries, far-field patterns, and a single-file release.
permalink: /portfolio/violet-mango/
thumbnail: /assets/portfolio/violet-mango/violet-mango-screenshot.png
tags:
  - Web app
  - Electromagnetics
  - Simulation
  - Single-file release
featured: false
in_apps: true
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Violet Mango</h1>
  <p class="lead">Violet Mango is a 2.5D finite-difference time-domain (FDTD) electromagnetic solver that runs entirely client-side as a single HTML file, with no install, server, or build step.</p>
</section>

<section class="section-grid">
  <article class="content-block">
    <h2>Project focus</h2>
    <p>The solver advances all six Cartesian field components on a Yee grid, treating the TMz and TEz modes independently. Geometry can be drawn with line, arc, spline, triangle, circle, ellipse, and dielectric lens tools, or imported from SVG, DXF, and Gerber files and mapped to materials.</p>
    <p>Sources are continuous-wave sinusoids with early stopping on steady-state convergence. Boundaries use a graded-conductivity PML. Results include steady-state phasor fields, time-history playback with GIF export, and a near-to-far-field transform with an approximate directivity estimate.</p>
    <p><a href="{{ '/apps/violet_mango.html' | relative_url }}">Launch the live browser app</a></p>
  </article>
  <article class="content-block">
    <h2>What it demonstrates</h2>
    <p>Violet Mango demonstrates Numerius Engineering's ability to deliver serious computational electromagnetics in an accessible package: numerical solver design, stability and boundary handling, equivalence-principle far-field computation, CAD file ingestion, and an interactive design-to-visualization workflow that needs nothing but a browser.</p>
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
      <img class="gallery-image" src="{{ '/assets/portfolio/violet-mango/violet-mango-screenshot.png' | relative_url }}" alt="Violet Mango materials workspace with grid settings, CAD import, and drawing tools">
      <h2>Materials and geometry workspace</h2>
      <p>Configure frequency, domain, and grid resolution, then build geometry from drawing primitives or imported CAD files before assigning materials and sources.</p>
    </article>
  </div>
</section>
