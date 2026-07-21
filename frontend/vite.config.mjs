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
      output: {
        manualChunks(id) {
          if (id.includes("/src/pages/")) {
            const [, rest] = id.split("/src/pages/");
            if (rest) {
              const normalized = rest.toLowerCase();
              if (
                normalized.startsWith("auth/") ||
                normalized.startsWith("login") ||
                normalized.startsWith("register") ||
                normalized.startsWith("forgot") ||
                normalized.startsWith("reset") ||
                normalized.startsWith("verify") ||
                normalized.startsWith("twofactor") ||
                normalized.startsWith("stepup") ||
                normalized.startsWith("unauthorized")
              ) {
                return "page-auth";
              }
              if (normalized.startsWith("ai/")) {
                return "page-ai";
              }
              if (
                normalized.startsWith("therapist") ||
                normalized.startsWith("radiologist") ||
                normalized.startsWith("surgeon") ||
                normalized.startsWith("staff/")
              ) {
                return "page-staff-lite";
              }
              if (
                normalized.startsWith("receptionist") ||
                normalized.startsWith("payrollofficer") ||
                normalized.startsWith("hrmanager")
              ) {
                return "page-admin-lite";
              }
              if (
                normalized.startsWith("analytics") ||
                normalized.startsWith("communication") ||
                normalized.startsWith("reports") ||
                normalized.startsWith("inventory")
              ) {
                return "page-ops-lite";
              }
              if (
                normalized.startsWith("guestdashboard") ||
                normalized.startsWith("careerslanding")
              ) {
                return "page-public";
              }
              if (
                normalized.startsWith("security") ||
                normalized.startsWith("labtech") ||
                normalized.startsWith("lab/") ||
                normalized.startsWith("pharmacy")
              ) {
                return "page-clinical-lite";
              }
              if (
                normalized.startsWith("payments") ||
                normalized.startsWith("workforce")
              ) {
                return "page-workflow-lite";
              }
              if (
                normalized.startsWith("nurse") ||
                normalized.startsWith("communityhealthworker")
              ) {
                return "page-care-lite";
              }
              if (normalized.startsWith("operations") || normalized.startsWith("developer")) {
                return "page-ops-core";
              }
              if (
                normalized.startsWith("appointments") ||
                normalized.startsWith("audit") ||
                normalized.startsWith("branches") ||
                normalized.startsWith("dashboard") ||
                normalized.startsWith("forbidden")
              ) {
                return "page-misc";
              }
              const group = rest.split("/")[0];
              if (group) return `page-${group.toLowerCase()}`;
            }
          }
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("d3")) return "charts";
          if (id.includes("socket.io-client")) return "socket";
          if (id.includes("@react-oauth")) return "oauth";
          return "vendor";
        },
      },
    },
  },
});
