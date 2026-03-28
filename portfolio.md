---
title: Portfolio
description: A project gallery for past work, prototypes, and build documentation.
---

<section class="page-header">
  <p class="eyebrow">Portfolio</p>
  <h1>Project gallery.</h1>
  <p class="lead">This gallery is driven by portfolio entries that can grow into image-heavy project case studies, build notes, and product snapshots over time.</p>
</section>

<section class="gallery-grid">
  {% assign portfolio_items = site.portfolio | sort: "title" %}
  {% for project in portfolio_items %}
    <article class="gallery-item">
      {% if project.thumbnail %}
        <img class="gallery-image" src="{{ project.thumbnail | relative_url }}" alt="{{ project.title }}">
      {% else %}
        <div class="gallery-frame"></div>
      {% endif %}
      {% if project.tags %}
        <div class="gallery-meta">
          {% for tag in project.tags limit:3 %}
            <span class="tag">{{ tag }}</span>
          {% endfor %}
        </div>
      {% endif %}
      <h2><a href="{{ project.url | relative_url }}">{{ project.title }}</a></h2>
      <p>{{ project.description }}</p>
    </article>
  {% endfor %}
</section>
