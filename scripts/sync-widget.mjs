// Builds the static publish folder (`widget/`) for Hubsy.
// Copy of .agent/web-app that can be dragged into Netlify or deployed to
// Firebase Hosting. Run: node scripts/sync-widget.mjs
import { mkdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, ".agent/web-app");
const dest = resolve(root, "widget");

const files = ["index.html", "chatbot.js", "knowledge-base.json"];

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const name of files) {
  const from = resolve(src, name);
  if (!existsSync(from)) {
    console.error(`[sync-widget] missing source file: ${from}`);
    process.exit(1);
  }
  copyFileSync(from, resolve(dest, name));
  console.log(`[sync-widget] ${name} -> widget/${name}`);
}
