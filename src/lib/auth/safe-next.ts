/**
 * Guards a post-auth redirect target.
 *
 * Kept in its own module rather than inline in the route handler so the
 * security-relevant logic can be exercised directly by tests, without needing a
 * real OAuth round-trip to observe the result.
 */

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    // C0 controls and DEL. A legitimate path contains none, and they are used
    // to confuse header and URL parsing.
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Restricts `next` to a relative path on this origin.
 *
 * `next` arrives in the query string, so it is attacker-controlled: a shared or
 * bookmarked callback URL could otherwise bounce a signed-in user to another
 * site. Several layers, because each catches something the others miss:
 *
 *  1. Shape checks. Must start with a single "/". "//host" is protocol-relative
 *     and resolves off-site; a leading "/\" does the same in browsers, which
 *     normalise backslashes to slashes. Backslashes and control characters are
 *     rejected outright rather than escaped, since a path has no legitimate use
 *     for them.
 *  2. Resolution against the request origin, which is what the browser will
 *     actually do with the value.
 *  3. An origin equality assertion on the result.
 *
 * The returned value is rebuilt from the parsed parts, so `next` cannot smuggle
 * a second origin through userinfo or an encoded delimiter.
 */
export function safeNext(raw: string | null | undefined, origin: string): string {
  if (!raw) return "/";

  const value = raw.trim();
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.includes("\\")) return "/";
  if (hasControlCharacters(value)) return "/";

  try {
    const target = new URL(value, origin);
    if (target.origin !== origin) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}