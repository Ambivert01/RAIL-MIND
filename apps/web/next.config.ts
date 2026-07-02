import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@railmind/shared-types"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        // Allow Render deployment URLs automatically
        ...(process.env.RENDER_EXTERNAL_HOSTNAME
          ? [process.env.RENDER_EXTERNAL_HOSTNAME]
          : []),
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.mapbox.com" },
    ],
  },
};

export default nextConfig;
