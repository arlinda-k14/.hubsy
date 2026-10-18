// Copies the canonical Hubsy data into the Functions bundle.
// The widgets read from .agent/web-app/, but Firebase only uploads the
// `functions/` directory, so these files must be copied in before deploy.
// Wired up as a `predeploy` hook in firebase.json.
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, ".agent/web-app");
const dest = resolve(root, "functions/data");

const files = ["knowledge-base.json", "system-prompt.txt"];

mkdirSync(dest, { recursive: true });

for (const name of files) {
  const from = resolve(src, name);
  if (!existsSync(from)) {
    console.error(`[sync-data] missing source file: ${from}`);
    process.exit(1);
  }
  copyFileSync(from, resolve(dest, name));
  console.log(`[sync-data] ${name} -> functions/data/${name}`);
}
