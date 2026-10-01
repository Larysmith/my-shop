import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next/image refuses to optimise a remote host that is not allowlisted, and
  // throws at render time rather than degrading.
  //
  // The Pixabay API returns full-size images on pixabay.com/get/<token>_<px>.jpg,
  // NOT cdn.pixabay.com — only the small previewURL and user avatar use that
  // host. Allowlisting the wrong hostname here would pass a typecheck and then
  // throw on every product page.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pixabay.com",
        pathname: "/get/**",
      },
      // Google serves OAuth profile pictures from this host. Without it,
      // rendering a signed-in user's avatar throws instead of degrading.
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;