import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distPath = resolve(root, "dist", "lovelace-m3-core-cards.js");
const source = await readFile(distPath, "utf8");

assert.match(source, /customElements\.define\(\s*"m3-slider"/);
assert.match(source, /customElements\.define\(\s*"m3-button"/);
assert.match(source, /customElements\.define\(\s*"m3-tabs"/);
assert.match(source, /customElements\.define\(\s*"m3-panel-stack"/);
assert.match(source, /type:\s*"m3-slider"/);
assert.match(source, /type:\s*"m3-button"/);
assert.match(source, /type:\s*"m3-tabs"/);
assert.match(source, /type:\s*"m3-panel-stack"/);
assert.match(source, /m3-slider-interaction-start/);
assert.match(source, /window\.customCards/);
assert.doesNotMatch(source, /custom:crooked-sentry|crooked-sentry-m3-|Crooked Sentry M3|crooked-sentry-panel-stack/);
