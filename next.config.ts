import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next writes agent instruction files at the repo root unless this is off.
  // The public repository carries no Markdown but its README.
  agentRules: false,
  // Put metadata in <head> for every client, so titles, canonicals and share
  // cards are in the first HTML any crawler or link previewer reads.
  htmlLimitedBots: /.*/,
  // Lets a second build (local fork tests) live next to the production one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The workspace asks wallets to sign, so no other site may frame it (clickjacking).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
