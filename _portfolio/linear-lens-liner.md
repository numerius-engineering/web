---
title: Linear Lens Liner
description: Browser-based planar optical design tool with paraxial ray tracing, FreeCAD lens export, and Fourier-optics beam propagation.
permalink: /portfolio/linear-lens-liner/
thumbnail: /assets/portfolio/linear-lens-liner/linear-lens-liner-screenshot.png
tags:
  - Web app
  - Optics
  - Simulation
  - Single-file release
featured: false
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Linear Lens Liner</h1>
  <p class="lead">Linear Lens Liner is a single-file, browser-based tool for designing planar side-view optical systems with paraxial ray tracing, plus a higher-fidelity Fourier-optics calculation on top of a finished design.</p>
</section>

<section class="section-grid">
  <article class="content-block">
    <h2>Project focus</h2>
    <p>Sources, lenses, and sinks are laid out on an optical-axis canvas with pan, zoom, and a snap grid. An ABCD-matrix ray trace reports spot diameter, centroid, magnification, per-ray results, and aperture clipping. Seven lens types are modeled with physical geometry derived from focal length and index of refraction.</p>
    <p>Each lens can produce a geometry report or a FreeCAD macro that builds the solid body. A 1D angular-spectrum split-step beam propagation runs through the meshed refractive-index profile of the lenses, with progress, cancellation, and JSON export. Designs save and load as JSON.</p>
    <p><a href="{{ '/apps/linear_lens_liner.html' | relative_url }}">Launch the live browser app</a></p>
  </article>
  <article class="content-block">
    <h2>What it demonstrates</h2>
    <p>Linear Lens Liner demonstrates Numerius Engineering's ability to connect engineering analysis to physical hardware: optical modeling at two levels of fidelity, direct hand-off to CAD, and an interactive design interface that needs no install, server, or build step.</p>
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
      <img class="gallery-image" src="{{ '/assets/portfolio/linear-lens-liner/linear-lens-liner-screenshot.png' | relative_url }}" alt="Linear Lens Liner showing a laser, focusing lens, and detector with ray trace results">
      <h2>Layout and ray-trace results</h2>
      <p>An example design with a laser source, focusing lens, and detector, alongside live spot size, magnification, ray table, and clipping report.</p>
    </article>
  </div>
</section>
