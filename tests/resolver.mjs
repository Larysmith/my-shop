/**
 * Minimal ESM resolver for the test runner and local scripts.
 *
 * The app source uses two conventions that the Next.js bundler resolves but
 * Node's ESM loader deliberately does not: extensionless relative imports, and
 * the `@/` path alias. Rather than adding a dependency, this resolves both so
 * the same modules can be loaded directly by `node`.
 *
 * Package imports are left untouched.
 */
import { fileURLToPath } from "node:url";

const SRC_ROOT = fileURLToPath(new URL("../src/", import.meta.url));

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`${specifier.slice(2)}.ts`, `file:///${SRC_ROOT.replace(/\\/g, "/")}`).href, context);
  }
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}