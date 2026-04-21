<p align="center">
  <picture>
    <!-- Desktop Dark Mode -->
    <source media="(min-width: 769px) and (prefers-color-scheme: dark)" srcset="assets/header-wide-dark-inline.svg">
    <!-- Desktop Light Mode -->
    <source media="(min-width: 769px) and (prefers-color-scheme: light)" srcset="assets/header-wide-light-inline.svg">
    <!-- Mobile Dark Mode -->
    <source media="(max-width: 768px) and (prefers-color-scheme: dark)" srcset="assets/header-stacked-dark-inline.svg">
    <!-- Mobile Light Mode -->
    <source media="(max-width: 768px) and (prefers-color-scheme: light)" srcset="assets/header-stacked-light-inline.svg">
    <img src="assets/header-wide-light-inline.svg" alt="lovelace-m3-core-cards" />
  </picture>
</p>

<p align="left" class="cs-repo-meta">
  <span class="cs-repo-subtitle">Part of the Crooked Sentry universe</span>
  <span class="cs-repo-meta-separator" aria-hidden="true">|</span>
  <span class="cs-repo-badges">
    <a href="https://github.com/josephmienko/lovelace-m3-core-cards/actions/workflows/validate.yml"><img src="https://github.com/josephmienko/lovelace-m3-core-cards/actions/workflows/validate.yml/badge.svg" alt="Validate" align="absmiddle" /></a>
    <a href="https://app.codecov.io/gh/josephmienko/lovelace-m3-core-cards"><img src="https://codecov.io/gh/josephmienko/lovelace-m3-core-cards/badge.svg" alt="Codecov test coverage" align="absmiddle" /></a>
  </span>
</p>

## Overview

`lovelace-m3-core-cards` is the recommended extraction target for the shared Lovelace primitives that currently live in this repo:

- slider
- button
- tabs
- panel stack

This repo ships those primitives as one HACS dashboard/plugin install unit with one built artifact: `dist/lovelace-m3-core-cards.js`.

## Why One Combined Repo

This is the recommended shape instead of four separate repos because it keeps:

- one HACS install
- one Lovelace resource
- one version stream
- one CI and release path
- one place for shared design-system evolution

If a downstream dashboard depends on any of these primitives, it can rely on one core-cards package instead of a chain of plugin installs.

## Repo Layout

```text
lovelace-m3-core-cards/
  .github/
    workflows/
      validate.yml
  dist/
    lovelace-m3-core-cards.js
  examples/
    button-basic.yaml
    panel-stack-basic.yaml
    slider-basic.yaml
    tabs-basic.yaml
  scripts/
    build_plugin.mjs
  screenshots/
  src/
    m3-button.js
    m3-panel-stack.js
    m3-slider.js
    m3-tabs.js
  tests/
    validate-dist.mjs
  .gitignore
  README.md
  hacs.json
  package.json
```

## Included Cards

- `custom:m3-slider`
- `custom:m3-button`
- `custom:m3-tabs`
- `custom:m3-panel-stack`

## HACS Install

1. Add the repository to HACS as a `Dashboard`.
2. Install `M3 Core Cards`.
3. Add the resource if HACS does not do it automatically:

   ```text
   /hacsfiles/lovelace-m3-core-cards/lovelace-m3-core-cards.js
   ```

4. Use any of the included cards in Lovelace.

## Manual Install

1. Copy `dist/lovelace-m3-core-cards.js` into your Home Assistant `www/` directory.
2. Add it as a Lovelace module resource:

   ```text
   /local/lovelace-m3-core-cards.js
   ```

3. Use any of the included cards in Lovelace.

## Maintainer Workflow

1. Edit the primitive source modules in `src/`.
2. Rebuild the install artifact:

   ```bash
   npm run build
   ```

3. Run validation:

   ```bash
   npm run check
   npm test
   ```

4. Commit both the source files and the generated `dist/lovelace-m3-core-cards.js`.

The CI workflow fails if the built artifact is out of date.

## Packaging Rules

- `dist/` contains only installable runtime artifacts.
- `examples/` contains copy/paste Lovelace snippets only.
- `screenshots/` is for README assets only.
- Public examples and defaults should use stock `mdi:` icons.
- The extracted repo does not currently bundle the private `m3*` icon registration/fonts; if you want to support those publicly, treat them as a separate optional dependency or ship them explicitly under `dist/`.
- If the repo later needs helper runtime assets, put them in `dist/`.

## Recommended Public Renames

Recommended public names for the extracted repo:

- `crooked-sentry-m3-slider` -> `m3-slider`
- `crooked-sentry-m3-button` -> `m3-button`
- `crooked-sentry-m3-tabs` -> `m3-tabs`
- `crooked-sentry-panel-stack` -> `m3-panel-stack`

That applies to:

- custom element tags
- `window.customCards` type names
- example snippets
- README docs

## Extraction Mapping

Current source files in this monorepo map to the extracted repo like this:

- `homeassistant/www/community/crooked-sentry-m3-slider/crooked-sentry-m3-slider.js` -> `src/m3-slider.js`
- `homeassistant/www/community/crooked-sentry-m3-button/crooked-sentry-m3-button.js` -> `src/m3-button.js`
- `homeassistant/www/community/crooked-sentry-m3-tabs/crooked-sentry-m3-tabs.js` -> `src/m3-tabs.js`
- `homeassistant/www/community/crooked-sentry-panel-stack/crooked-sentry-panel-stack.js` -> `src/m3-panel-stack.js`

The existing files are already independently structured enough to combine into one build artifact by concatenation or bundling.

## Notes

- This template now carries the current extracted implementations for slider, button, tabs, and panel stack with the public `m3-*` tags already applied.
- The tabs card still supports external `m3*` icon sets if users already have them registered, but the public defaults/examples use `mdi:` icons.
- The current lighting dashboard should be treated as a separate repo that consumes this one, not as part of the core-cards package.
