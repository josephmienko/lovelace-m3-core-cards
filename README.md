<h1 style="display: none;"><a href="https://josephmienko.github.io/lovelace-m3-core-cards/">lovelace-m3-core-cards</a></h1>
<picture align="center">
  <!-- Desktop Dark Mode -->
  <source media="(min-width: 769px) and (prefers-color-scheme: dark)" srcset="assets/header-wide-dark-inline.svg">
  <!-- Desktop Light Mode -->
  <source media="(min-width: 769px) and (prefers-color-scheme: light)" srcset="assets/header-wide-light-inline.svg">
  <!-- Mobile Dark Mode -->
  <source media="(max-width: 768px) and (prefers-color-scheme: dark)" srcset="assets/header-stacked-dark-inline.svg">
  <!-- Mobile Light Mode -->
  <source media="(max-width: 768px) and (prefers-color-scheme: light)" srcset="assets/header-stacked-light-inline.svg">
  <img src="assets/header-wide-light-inline.svg" alt="lovelace-m3-core-cards">
</picture>
<b align="left" class="cs-repo-meta">
  <span class="cs-repo-subtitle">Part of the Crooked Sentry universe</span>
  <span class="cs-repo-meta-separator" aria-hidden="true">|</span>
  <span class="cs-repo-badges">
    <a href="https://github.com/josephmienko/lovelace-m3-core-cards/actions/workflows/validate.yml"><img src="https://github.com/josephmienko/lovelace-m3-core-cards/actions/workflows/validate.yml/badge.svg" alt="Validate" align="absmiddle" /></a>
    <a href="https://app.codecov.io/gh/josephmienko/lovelace-m3-core-cards"><img src="https://codecov.io/gh/josephmienko/lovelace-m3-core-cards/badge.svg" alt="Codecov test coverage" align="absmiddle" /></a>
  </span>
</b>

M3 design system primitives for Lovelace: slider, button, tabs, and panel stack. Single combined HACS install with bundled components to avoid dependency chains.

## Configuration

### Installation Instructions

#### HACS Install

1. Add the repository to HACS as a `Dashboard`.
2. Install `M3 Core Cards`.
3. Add the resource if HACS does not do it automatically:

   ```text
   /hacsfiles/lovelace-m3-core-cards/lovelace-m3-core-cards.js
   ```

4. Use any of the included cards in Lovelace.

#### Manual Install

1. Copy `dist/lovelace-m3-core-cards.js` into your Home Assistant `www/` directory.
2. Add it as a Lovelace module resource:

   ```text
   /local/lovelace-m3-core-cards.js
   ```

3. Use any of the included cards in Lovelace.

### Available Cards

- `custom:m3-slider`
- `custom:m3-button`
- `custom:m3-tabs`
- `custom:m3-panel-stack`

### Maintainer Workflow

1. Edit the primitive source modules in `src/`.
2. Rebuild the install artifact:

   ```bash
   npm run build
   ```

3. Run validation:

   ```bash
   npm run check
  # Design Rationale

This repo combines multiple primitives into a single install unit because it maintains:

- One HACS install (cleaner for end users)
- One Lovelace resource URL
- One version stream for all primitives
- Shared design-system evolution in one place

Downstream dashboards can depend on one core-cards package instead of managing separate plugin installs
The existing files are already independently structured enough to combine into one build artifact by concatenation or bundling.

## Notes

- This template now carries the current extracted implementations for slider, button, tabs, and panel stack with the public `m3-*` tags already applied.
- The tabs card still supports external `m3*` icon sets if users already have them registered, but the public defaults/examples use `mdi:` icons.
- The current lighting dashboard should be treated as a separate repo that consumes this one, not as part of the core-cards package.
