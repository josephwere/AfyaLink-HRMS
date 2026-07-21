import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const buildId =
  process.env.VITE_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  "";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["@stripe/stripe-js"],
    },
  },
});
