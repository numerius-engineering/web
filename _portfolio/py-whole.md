---
title: Py-Whole
description: Offline browser notebook workbench with Pyodide execution, project files, and a standalone single-file HTML release.
permalink: /portfolio/py-whole/
thumbnail: /assets/portfolio/py-whole/py-whole-logo.png
tags:
  - Web app
  - Python
  - Pyodide
  - Productization
featured: true
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Py-Whole</h1>
  <p class="lead">Py-Whole is an offline browser notebook workbench that packages Python execution, notebook authoring, project files, and portable distribution into a single standalone HTML file.</p>
</section>

<section class="section-grid">
  <article class="content-block">
    <h2>Project focus</h2>
    <p>This project centered on building a notebook-style Python environment that remains usable without a server: notebook cells, markdown, project files, bundled scientific packages, and browser persistence all ship together in one portable artifact.</p>
    <p>The result is a browser-first engineering workspace that can be hosted, shared, or reopened later without depending on a traditional backend notebook service.</p>
    <p><a href="{{ '/apps/py_whole/' | relative_url }}">Launch the live browser app</a></p>
  </article>
  <article class="content-block">
    <h2>What it demonstrates</h2>
    <p>Py-Whole demonstrates Numerius Engineering's ability to package a technically heavier browser application, embed an offline Python runtime, manage single-file release constraints, and still preserve a practical engineering workspace for real notebook use.</p>
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
      <img class="gallery-image" src="{{ '/assets/portfolio/py-whole/py-whole-logo.png' | relative_url }}" alt="Py-Whole notebook workspace">
      <h2>Offline notebook workspace</h2>
      <p>Notebook cells, markdown authoring, project files, tabs, and local persistence are packaged into a browser-first workspace that does not depend on a backend service.</p>
    </article>
    <article class="gallery-item">
      <img class="gallery-image" src="{{ '/assets/portfolio/py-whole/py-whole-logo.png' | relative_url }}" alt="Py-Whole embedded Python runtime">
      <h2>Embedded Python runtime</h2>
      <p>Pyodide-backed execution provides bundled scientific Python packages directly in the browser while preserving a single-file release target suitable for portable distribution.</p>
    </article>
    <article class="gallery-item">
      <img class="gallery-image" src="{{ '/assets/portfolio/py-whole/py-whole-logo.png' | relative_url }}" alt="Py-Whole portable single-file distribution">
      <h2>Web-hostable distribution</h2>
      <p>The application can also be packaged as a static web-served folder, keeping individual files small enough for conventional site hosting while preserving the same notebook workspace behavior.</p>
    </article>
  </div>
</section>
