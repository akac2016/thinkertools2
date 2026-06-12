import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this config file's directory so Turbopack's
    // root inference can never walk up into a parent/home dir (e.g.
    // ~/node_modules/tailwindcss@3). __dirname is defined because this config
    // is loaded as CommonJS (no "type": "module" in package.json).
    root: __dirname,
  },
};

export default nextConfig;
