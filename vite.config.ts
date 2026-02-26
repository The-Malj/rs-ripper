import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ command }) => ({
  base:
    command === "serve"
      ? "/"
      : process.env.GITHUB_ACTIONS
        ? "https://the-malj.github.io/rs-ripper/"
        : "/",
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        sampler: resolve(__dirname, "dev-sampler.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
}));

