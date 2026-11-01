---
title: Euclid's Compass
description: Interactive straightedge-and-compass construction canvas with layers, length transport, equality checks, and a single-file release.
permalink: /portfolio/euclids-compass/
thumbnail: /assets/portfolio/euclids-compass/euclids-compass-screenshot.png
tags:
  - Web app
  - Geometry
  - Education
  - Single-file release
featured: false
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Euclid's Compass</h1>
  <p class="lead">Euclid's Compass is a browser-based canvas for doing straightedge-and-compass constructions in the spirit of Euclid's <em>Elements</em>, delivered as a single offline-capable HTML file.</p>
</section>

<section class="section-grid">
  <article class="content-block">
    <h2>Project focus</h2>
    <p>The app models Euclid's two instruments: an unmarked straightedge and a compass that can run in either a collapsing mode, as in the classical tradition, or a rigid mode, like a modern drafting compass. A Transport tool reproduces a length at a new location, following the method of Book I, Proposition 2.</p>
    <p>Constructions can be organized into layers with their own color, line style, visibility, and lock state. A Check tool compares segments, circles, or angles for equality, and the canvas supports touch gestures, pinch zoom, panning, undo and redo, and PNG export.</p>
    <p><a href="{{ '/apps/euclids_compass.html' | relative_url }}">Launch the live browser app</a></p>
  </article>
  <article class="content-block">
    <h2>What it demonstrates</h2>
    <p>Euclid's Compass demonstrates Numerius Engineering's ability to turn a conceptual or educational idea into a polished interactive tool: geometric snapping and intersection logic, a full pointer-events interaction model, a themed interface, and a no-build, no-server release that works straight from a file.</p>
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
      <img class="gallery-image" src="{{ '/assets/portfolio/euclids-compass/euclids-compass-screenshot.png' | relative_url }}" alt="Euclid's Compass workspace with tools, layers, and vellum canvas">
      <h2>Construction workspace</h2>
      <p>A tool palette for select, erase, point, line, compass, transport, and check, alongside a layers panel and a vellum-style drawing canvas.</p>
    </article>
  </div>
</section>
