---
title: Inspector Blanque
description: Browser-based chess position and game evaluator powered by local Stockfish analysis and packaged as a standalone single-file app.
permalink: /portfolio/inspector-blanque/
thumbnail: /assets/portfolio/inspector-blanque/inspector-blanque-logo.png
tags:
  - Web app
  - Chess
  - WebAssembly
  - Productization
featured: true
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Inspector Blanque</h1>
  <p class="lead">Inspector Blanque is a browser-based chess analysis tool that evaluates FEN and PGN input locally with Stockfish, presents move quality in an accessible interface, and ships as a downloadable single-file HTML application.</p>
</section>

<section class="section-grid">
  <article class="content-block">
    <h2>Project focus</h2>
    <p>This project centered on packaging a serious analysis workflow into a portable front-end experience: local engine execution, move-by-move review tools, board visualization, and a standalone browser artifact that can run without a traditional install process.</p>
    <p><a href="{{ '/apps/Inspector_Blanque_v3_3_0_single_file.html' | relative_url }}">Launch the live browser app</a></p>
  </article>
  <article class="content-block">
    <h2>What it demonstrates</h2>
    <p>Inspector Blanque demonstrates Numerius Engineering's ability to productize a technically heavier browser application, manage local computational dependencies, and convert a multi-asset web tool into a single-file release fit for hosted distribution.</p>
    <p><a href="{{ '/apps/' | relative_url }}">Browse the Apps gateway</a></p>
  </article>
</section>

<section class="section-block">
  <div class="section-heading">
    <p class="eyebrow">Highlights</p>
    <h2>Key capabilities from the delivered browser release.</h2>
  </div>
  <div class="gallery-grid">
    <article class="gallery-item">
      <img class="gallery-image" src="{{ '/assets/portfolio/inspector-blanque/inspector-blanque-logo.png' | relative_url }}" alt="Inspector Blanque application overview">
      <h2>Local engine analysis</h2>
      <p>Client-side Stockfish analysis supports FEN and PGN input directly in the browser, with no external analysis service required for core evaluation.</p>
    </article>
    <article class="gallery-item">
      <img class="gallery-image" src="{{ '/assets/portfolio/inspector-blanque/game-view.svg' | relative_url }}" alt="Inspector Blanque game view illustration">
      <h2>Interactive review workflow</h2>
      <p>Game View tools make it possible to step through a PGN, inspect board states, reveal best moves on demand, and jump directly to mistakes or blunders.</p>
    </article>
    <article class="gallery-item">
      <img class="gallery-image" src="{{ '/assets/portfolio/inspector-blanque/release-architecture.svg' | relative_url }}" alt="Inspector Blanque release architecture illustration">
      <h2>Portable packaging</h2>
      <p>The final release bundles UI code, piece assets, chess parsing, engine bootstrap, and WASM payload into a single HTML file suitable for direct distribution.</p>
    </article>
  </div>
</section>
