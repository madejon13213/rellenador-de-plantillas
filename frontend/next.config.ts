import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web estática: `next build` genera la carpeta out/, que se sube a S3 y se sirve con CloudFront.
  output: "export",
  // /usuarios -> /usuarios/index.html, que es lo que S3 puede servir sin servidor.
  trailingSlash: true,
};

export default nextConfig;
