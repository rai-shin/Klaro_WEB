import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js"],

  outputFileTracingIncludes: {
    "/api/ocr/process": [
      "./node_modules/tesseract.js-core/**/*.wasm",
    ],
  },
};

export default nextConfig;