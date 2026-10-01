import { readFileSync, writeFileSync } from "node:fs";

// Adds a key to .env.local without printing its contents (it holds secrets).
const file = new URL("../.env.local", import.meta.url);
const key = process.argv[2];
const value = process.argv[3];

if (!key) {
  console.error("usage: node scripts/env-set.mjs KEY VALUE");
  process.exit(1);
}

let text = readFileSync(file, "utf8");
const line = `${key}=${JSON.stringify(value)}`;
const re = new RegExp(`^${key}=.*$`, "m");

if (re.test(text)) {
  text = text.replace(re, line);
  console.log(`updated ${key}`);
} else {
  text = `${text.replace(/\s*$/, "")}\n\n# added by env-set\n${line}\n`;
  console.log(`added ${key}`);
}

writeFileSync(file, text, "utf8");
