import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js"],

  outputFileTracingRoot: path.join(__dirname),

  outputFileTracingIncludes: {
    "/api/ocr/process": [
      "./node_modules/tesseract.js-core/**/*.wasm",
    ],
  },
};

export default nextConfig;