---
title: Wordle Wizard
description: Browser-based Wordle advisor with a Rust/WASM solver, background-worker execution, and a downloadable single-file build.
permalink: /portfolio/wordle-wizard/
thumbnail: /assets/portfolio/wordle-wizard/wordle-wizard-screenshot.png
tags:
  - Web app
  - Rust
  - WebAssembly
  - Productization
featured: true
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Wordle Wizard</h1>
  <p class="lead">Wordle Wizard is a browser-based advisor for live Wordle play, combining a Rust solver, WebAssembly delivery, and a single-file release workflow for portable distribution.</p>
</section>

<section class="section-grid">
  <article class="content-block">
    <h2>Project focus</h2>
    <p>This project centered on rewriting a legacy solver into a portable Rust codebase, exposing it through WebAssembly, and packaging it into a browser-friendly interface that can be used either from a hosted site or as a standalone downloadable HTML file.</p>
    <p><a href="{{ '/apps/wordle_wizard_v1.1.1_single_file.html' | relative_url }}">Launch the live browser app</a></p>
  </article>
  <article class="content-block">
    <h2>What it demonstrates</h2>
    <p>Wordle Wizard demonstrates Numerius Engineering's ability to modernize existing software, improve portability, preserve strong compute behavior in the browser, and ship distribution-friendly artifacts backed by GitHub release automation.</p>
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
      <img class="gallery-image" src="{{ '/assets/portfolio/wordle-wizard/wordle-wizard-screenshot.png' | relative_url }}" alt="Wordle Wizard application overview">
      <h2>Analyst UI</h2>
      <p>Dark-mode interface for entering guesses, applying feedback, reviewing candidate answers, and selecting recommendations directly into the current guess.</p>
    </article>
    <article class="gallery-item">
      <img class="gallery-image" src="{{ '/assets/portfolio/wordle-wizard/Wordle-Wizard-screenshot2.png' | relative_url }}" alt="Wordle Wizard packaged application screenshot">
      <h2>Portable distribution</h2>
      <p>Single-file HTML packaging backed by versioned release assets so the app can be downloaded and opened directly in a browser.</p>
    </article>
    <article class="gallery-item">
      <img class="gallery-image" src="{{ '/assets/portfolio/wordle-wizard/Wordle-Wizard-screenshot3.png' | relative_url }}" alt="Wordle Wizard compute architecture screenshot">
      <h2>Browser compute architecture</h2>
      <p>Rust/WASM engine with worker-backed execution for hosted use and a direct fallback path for standalone local-file launches.</p>
    </article>
  </div>
</section>
