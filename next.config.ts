import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the node_modules it actually
  // uses, so the production image stays small. Required by the runner stage of
  // the Dockerfile.
  output: "standalone",
};

export default nextConfig;
