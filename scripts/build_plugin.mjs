import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "dist", "lovelace-m3-core-cards.js");
const sourceFiles = [
  "src/m3-slider.js",
  "src/m3-button.js",
  "src/m3-tabs.js",
  "src/m3-panel-stack.js",
];

const banner = `/**
 * Built file for the M3 Core Cards HACS artifact.
 * Edit the modules in src/ and rerun npm run build.
 */

`;

const parts = await Promise.all(
  sourceFiles.map(async (relativePath) => {
    const absolutePath = resolve(root, relativePath);
    const source = await readFile(absolutePath, "utf8");
    return `// ${relativePath}\n${source.trimEnd()}\n`;
  })
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, banner + parts.join("\n"), "utf8");
