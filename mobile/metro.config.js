const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const shopSrc = path.resolve(projectRoot, "..", "src");

const config = getDefaultConfig(projectRoot);

// The app imports the shop's pure money, catalog and cart modules directly from
// ../src rather than copying them, so a total or a cart line cannot drift between
// the web and the phone.
//
// Only `src` is watched, not the whole repository, and only the modules that have
// no bare imports are shared. src/lib/cart/remote.ts is deliberately NOT shared:
// it imports @supabase/supabase-js, and letting it resolve from the repo's
// node_modules would load a second copy of the client alongside the app's own.
// The mobile app has its own Data API module instead; the logic worth sharing —
// hydration, merging, clamping, totals — is all in the pure modules.
config.watchFolders = [shopSrc];

module.exports = config;
