import CopyPlugin from "copy-webpack-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Prevent webpack from bundling the onnxruntime-node native binary (.node file).
    // @huggingface/transformers pulls it in transitively; we only use onnxruntime-web.
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "onnxruntime-node",
    ];

    if (!isServer) {
      config.resolve.fallback = { fs: false };
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
