import CopyPlugin from "copy-webpack-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // These packages are loaded as static files from /public — never bundle them
  serverExternalPackages: ["onnxruntime-node", "onnxruntime-web"],
  webpack: (config, { isServer }) => {
    // Prevent webpack from bundling native / wasm packages
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "onnxruntime-node",
    ];

    if (!isServer) {
      config.resolve.fallback = { fs: false };

      // Fix: webpack/SWC can't parse large ONNX runtime .mjs files (WGSL shader strings).
      // Treat all node_modules .mjs files as plain JS (not strict ES module).
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: "javascript/auto",
        resolve: { fullySpecified: false },
      });

      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: "node_modules/onnxruntime-web/dist/*.wasm",
              to: "../public/[name][ext]",
            },
            {
              from: "node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js",
              to: "../public/[name][ext]",
            },
            {
              from: "node_modules/@ricky0123/vad-web/dist/*.onnx",
              to: "../public/[name][ext]",
            },
            {
              from: "node_modules/onnxruntime-web/dist/*.mjs",
              to: "../public/[name][ext]",
            },
          ],
        })
      );
    }
    return config;
  },
};

export default nextConfig;
