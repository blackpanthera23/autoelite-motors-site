# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A static marketing website for "AutoElite Motors" (a car dealership). There is no build system, package manager, framework, or test suite — just plain self-contained HTML files. Each page (`index.html`, `contact.html`, `portfolio.html`) is a single file with its own inline `<style>` block and inline `<script>`; there are no shared `.css`/`.js` files.

## Running the site

There is nothing to build or install. To preview with working relative links, serve the directory over HTTP rather than opening files directly (Chrome browser tooling in particular cannot navigate `file://` URLs):

```bash
python3 -m http.server 8934
```

Then visit `http://localhost:8934/index.html`.

## Architecture / conventions

- **No shared CSS/JS.** Every page repeats the full `<style>` block (nav, section shared classes, footer, etc.) inline in its own `<head>`. When changing something global — a color, the nav links, the footer text — it must be edited in **every** HTML file individually, not just one.
- **Common structural pattern across pages**: fixed `nav` → hero/`page-header` → one or more `section`s using shared classes (`section-label`, `section-title`, `section-sub`) → card grid (`*-grid` / `*-card`, e.g. `car-grid`/`car-card`, `sale-grid`/`sale-card`, `testi-grid`/`testi-card`) → dark `footer`. New pages should copy this structure and its CSS from the most similar existing page rather than introducing new patterns.
- **Design tokens (used consistently, not extracted into variables)**: gold accent `#e8b400`, near-black `#0a0a0a`/`#1a1a1a`, light section background `#f7f7f7`, body font stack `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`.
- **Navigation**: each page's `nav ul` lists the same links (`Inventory`, `Why Us`, `Reviews`, `Portfolio`, `Contact`); in-page anchors (`#inventory`, `#why-us`, `#testimonials`) live on `index.html`, so links to them from other pages are prefixed `index.html#...`. The current page's own nav link gets `class="active"`. Smooth scrolling for `#`-anchors is handled by a small inline script at the bottom of `index.html`.
- **Content placeholders**: vehicle/photo imagery is represented with emoji inside gradient tiles (`.car-img`, `.sale-img`) rather than real images — follow this convention when adding more cards.
- **Forms**: `contact.html`'s form has no backend; `handleSubmit()` just prevents default submission and reveals a "thanks" message client-side.

# user info

Panggil saya Akmal

# Props 

Use dedicated props type instead of inline props type

Example
```
Export function CourseForm({

}: CourseFormProps)
```

Always use named function instead of anonymous function