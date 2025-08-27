import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
