import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  // No server features anywhere in this app, so the whole thing exports to
  // static files. Making that a build-enforced property rather than a claim
  // also keeps the output portable across hosts.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // With npm workspaces, Turbopack's root inference walks up looking for a
  // lockfile and can land somewhere unexpected. Pin it to the repo root.
  turbopack: { root: path.join(here, "..") },
  // The dev overlay badge sits on top of the atlas in the bottom-left corner,
  // which is exactly where the map's own chrome goes.
  devIndicators: false,
};

export default config;
