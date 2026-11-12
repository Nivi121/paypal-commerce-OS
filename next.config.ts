import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GPU-friendly: disable source maps in prod to reduce memory/CPU usage
  productionBrowserSourceMaps: false,

  // Vercel Serverless compatible
  output: undefined, // default: server

  // Suppress lucide-react + AG Grid ESM warnings
  experimental: {
    optimizePackageImports: ["lucide-react", "ag-grid-react", "ag-grid-community"],
  },

  // Allow PayPal, Channel3, and local domains
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.paypal.com" },
      { protocol: "https", hostname: "**.sandbox.paypal.com" },
      { protocol: "https", hostname: "**.trychannel3.com" },
      { protocol: "https", hostname: "**.amazon.com" },
      { protocol: "https", hostname: "**.lenovo.com" },
    ],
  },

  // Environment variable exposure to client
  env: {
    NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "sb",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
};

export default nextConfig;
