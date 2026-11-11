---
title: Design Portfolio
description: Physical designs and fabrication projects built by Numerius Engineering.
permalink: /design-portfolio/
---

<section class="page-header">
  <p class="eyebrow">Design Portfolio</p>
  <h1>Things I've built.</h1>
  <p class="lead">Physical designs, prototypes, and fabrication projects, from 3D-printed parts to race-day tuning.</p>
</section>

<section class="gallery-grid">
  {% assign design_items = site.portfolio | where: "category", "design" | sort: "title" %}
  {% for project in design_items %}
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
