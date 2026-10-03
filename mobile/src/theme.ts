import { useColorScheme } from "react-native";

/**
 * Colours, mirroring the tokens in src/app/globals.css.
 *
 * The website is styled with Tailwind against `--background` and `--foreground`
 * plus a dark-mode override. There is no Tailwind here — pulling in a CSS pipeline
 * for six colours would be a dependency for nothing — so the two schemes are
 * spelled out and applied through StyleSheet.
 */

const LIGHT = {
  background: "#ffffff",
  surface: "#ffffff",
  foreground: "#111111",
  muted: "rgba(17, 17, 17, 0.55)",
  faint: "rgba(17, 17, 17, 0.38)",
  border: "rgba(17, 17, 17, 0.10)",
  borderStrong: "rgba(17, 17, 17, 0.18)",
  placeholder: "rgba(17, 17, 17, 0.04)",
  danger: "#c02626",
};

const DARK = {
  background: "#0b0b0c",
  surface: "#141416",
  foreground: "#ededed",
  muted: "rgba(237, 237, 237, 0.6)",
  faint: "rgba(237, 237, 237, 0.4)",
  border: "rgba(237, 237, 237, 0.12)",
  borderStrong: "rgba(237, 237, 237, 0.22)",
  placeholder: "rgba(237, 237, 237, 0.06)",
  danger: "#f87171",
};

export type Theme = typeof LIGHT;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}

/**
 * Turns a catalog image path into something fetchable.
 *
 * `products.image_url` holds a site-relative path like
 * `/products/everyday-cotton-tee.jpg`, which is meaningless to a phone — there is
 * no origin to resolve it against. The shop's deployed URL comes from
 * EXPO_PUBLIC_SITE_URL.
 *
 * Returns null when there is nothing to point at, so a missing image renders as a
 * neutral block rather than a broken request. Note the consequence: until the shop
 * is deployed and this variable is set, the app shows placeholders instead of
 * photographs. The images live in the website's public/ directory, not in Supabase
 * Storage, so there is nowhere else for the app to fetch them from.
 */
export function absoluteImageUrl(
  path: string | null | undefined,
  siteUrl: string | undefined,
): string | null {
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) return path;
  if (!siteUrl) return null;

  return `${siteUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}