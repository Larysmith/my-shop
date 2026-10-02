/**
 * Fails if a client component can reach server-only code, or the demo dataset.
 *
 * A `"use client"` file may import another `"use client"` file freely, and may
 * import plain shared modules. What it must never do is pull in a module marked
 * `import "server-only"`: that throws at build time on Vercel, and the error
 * names the importing component rather than the module that caused it.
 *
 * The second rule is the subtler one. `@/lib/catalog` is the demo dataset. A
 * component that imports it in production mode reads the wrong rows: demo ids
 * are p-001..p-008 while Postgres ids are UUIDs, so a lookup silently returns
 * undefined instead of throwing. That is exactly how cart thumbnails quietly
 * regressed to placeholder art. Types and pure helpers belong in
 * `@/lib/catalog-types`; server reads belong in `@/lib/server/catalog`.
 *
 *   node scripts/check-client-boundaries.mjs
 */

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** Modules that must never be reachable from a client component. */
const SERVER_ONLY = "server-only";

/**
 * Data that is only correct in demo mode. Types and pure helpers are fine and
 * live in catalog-types; the dataset itself does not.
 */
const DEMO_DATA_FILES = new Set(["src/lib/catalog.ts", "src/lib/demo/seed.ts"]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = await walk(SRC);
const fileSet = new Set(files.map((f) => resolve(f)));

/** Cached per file: its import specifiers, and the two markers we care about. */
const cache = new Map();

async function readModule(file) {
  const cached = cache.get(file);
  if (cached) return cached;

  const source = await readFile(file, "utf8");
  const specifiers = new Set();

  // Static imports, re-exports and bare side-effect imports. Dynamic import() of
  // a server module would also be a bug, but matching those produces false
  // positives on conditional paths, and there are none in this codebase.
  const patterns = [
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?[^;]*?from\s*["']([^"']+)["']/g,
    /(?:^|\n)\s*import\s+["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }

  const info = {
    isClient: /^\s*(?:\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(source),
    // A Server Action is a legitimate crossing point: the browser imports the
    // action module, but only as an RPC reference. Next bundles the action's own
    // imports on the server, so traversal must stop here or every action flags.
    isServerAction: /^\s*(?:\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(source),
    isServerOnly: new RegExp(`["']${SERVER_ONLY}["']`).test(source),
    specifiers,
  };

  cache.set(file, info);
  return info;
}

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;

  const base = specifier.startsWith("@/")
    ? join(SRC, specifier.slice(2))
    : resolve(dirname(fromFile), specifier);

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => fileSet.has(resolve(candidate))) ?? null;
}

const rel = (file) => relative(ROOT, file).replace(/\\/g, "/");

// Preload every module, so the graph walk below can read the cache synchronously.
for (const file of files) await readModule(file);

const clientEntries = [];
for (const file of files) {
  if (cache.get(file).isClient) clientEntries.push(file);
}

const serverOnlyModules = new Set();
for (const file of files) {
  if (cache.get(file).isServerOnly) serverOnlyModules.add(rel(file));
}

/**
 * Modules that legitimately end the walk.
 *
 * Server Actions are RPC references, so the browser never bundles their imports.
 * The demo subtree only mounts behind `<DemoProvider>`, which production does not
 * render, so it may read the demo dataset by definition.
 */
const isBoundary = (file) => {
  const current = rel(file);
  return (
    cache.get(file).isServerAction ||
    current.startsWith("src/components/demo/") ||
    current.startsWith("src/lib/demo/")
  );
};

/** Breadth-first walk from one client entry, recording the chain to each module. */
function reachableFrom(entry) {
  const seen = new Set([entry]);
  const queue = [[entry, [entry]]];
  const hits = [];

  while (queue.length > 0) {
    const [file, path] = queue.shift();
    const info = cache.get(file);
    const current = rel(file);

    if (serverOnlyModules.has(current)) {
      hits.push({ kind: "server-only", reached: current, via: path });
    } else if (DEMO_DATA_FILES.has(current)) {
      hits.push({ kind: "demo-data", reached: current, via: path });
    }

    if (isBoundary(file)) continue;

    for (const specifier of info.specifiers) {
      const next = resolveSpecifier(file, specifier);
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push([next, [...path, next]]);
      }
    }
  }

  return hits;
}

// One report per (kind, reached) is enough to act on; the first chain found is
// representative.
const unique = new Map();
for (const entry of clientEntries) {
  for (const hit of reachableFrom(entry)) {
    const key = `${hit.kind}:${hit.reached}`;
    if (!unique.has(key)) {
      unique.set(key, { ...hit, from: rel(entry) });
    }
  }
}

const violations = [...unique.values()];

if (violations.length > 0) {
  console.error("Client boundary violations:\n");
  for (const violation of violations.sort((a, b) => a.reached.localeCompare(b.reached))) {
    const label =
      violation.kind === "server-only"
        ? "client component reaches server-only code"
        : "client component reaches the demo dataset";
    console.error(`  ${label}`);
    console.error(`    reached: ${violation.reached}`);
    console.error(`    from:    ${violation.from}`);
    console.error(`    chain:   ${violation.via.map(rel).join(" -> ")}\n`);
  }
  console.error(
    "Move shared types/helpers into @/lib/catalog-types, and server reads into a\n" +
      "module under @/lib/server so only server components import them.",
  );
  process.exit(1);
}

console.log(
  `Client boundaries OK: ${clientEntries.length} client components reach no server-only or demo-data module.`,
);
