import type { NextConfig } from "next";

/**
 * SpinUp is superseded by Help me grow in Yams (github.com/Detoil/Yams).
 *
 * Set SUPERSEDED_BY_URL to the Yams address and every route redirects there.
 * Leave it unset until each team's work has been exported with the Detoil
 * export, because the redirect also takes the export page away.
 */
const supersededBy = process.env.SUPERSEDED_BY_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async redirects() {
    if (!supersededBy) return [];
    return [{ source: "/:path*", destination: supersededBy, permanent: false }];
  },
};

export default nextConfig;
