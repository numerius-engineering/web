---
title: Green Olive
description: Browser-based GPS sky and signal simulator that generates L1 C/A, L2C, and L5 baseband IQ recordings with real navigation message content.
permalink: /portfolio/green-olive/
thumbnail: /assets/portfolio/green-olive/green-olive-screenshot.png
tags:
  - Web app
  - GNSS
  - Signal processing
  - Productization
featured: false
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Green Olive</h1>
  <p class="lead">Green Olive is a browser-based GPS signal simulator that shows which satellites are overhead for a chosen place and time, then generates matching baseband IQ recordings for SDR and receiver test software.</p>
</section>

<section class="section-grid">
  <article class="content-block">
    <h2>Project focus</h2>
    <p>The app pulls live GPS almanac data, propagates orbits with full SGP4/SDP4, and renders a sky view of the constellation. It then synthesizes a simulated L1 C/A, L2C, or L5 recording as a stereo <code>.wav</code> file, with I and Q on the left and right channels, built from real broadcast-format LNAV and CNAV navigation messages fitted to the satellites' actual orbits.</p>
    <p>It is intended as offline test data and not for RF transmission. It runs with no build step, and DSP work is handled in a Web Worker so the interface stays responsive.</p>
    <p><a href="{{ '/apps/green_olive/gps-sim.html' | relative_url }}">Launch the live browser app</a> &middot; <a href="{{ '/apps/green_olive/help.html' | relative_url }}">Read the documentation</a></p>
  </article>
  <article class="content-block">
    <h2>What it demonstrates</h2>
    <p>Green Olive demonstrates Numerius Engineering's depth in GNSS signal structure and digital signal processing: PRN code generators, ephemeris least-squares fitting, front-end filtering, AGC and ADC quantization modeling, elevation-dependent multipath, and a built-in correlator view for verifying acquisition, all delivered as a modular static web package.</p>
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
      <img class="gallery-image" src="{{ '/assets/portfolio/green-olive/green-olive-screenshot.png' | relative_url }}" alt="Green Olive observer, sky view, and IQ generation controls">
      <h2>Sky view and recording controls</h2>
      <p>Set observer position and time, fetch a live almanac, compute satellites overhead, and configure signal, sample rate, duration, noise floor, bandwidth, AGC, and quantization before generating a recording.</p>
    </article>
  </div>
</section>
