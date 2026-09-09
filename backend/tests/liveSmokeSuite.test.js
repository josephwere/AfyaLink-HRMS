import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const smokeScript = path.join(backendDir, "scripts", "live-smoke-suite.mjs");

describe("live-smoke-suite", () => {
  it("does not fail the workflow when the required role smoke credentials are absent", () => {
    const envKeys = [
      "BASE_URL",
      "FRONTEND_BASE_URL",
      "BACKEND_BASE_URL",
      "PROBE_LABEL",
      "PROBE_REGION",
      "ROLE_FILTER",
      "REQUIRED_ROLE_SUITES",
      "SMOKE_STRICT_REQUIRED_ROLE_SUITES",
      "SMOKE_SUMMARY_PATH",
      "SUPER_ADMIN_IDENTIFIER",
      "SUPER_ADMIN_PASSWORD",
      "HOSPITAL_ADMIN_IDENTIFIER",
      "HOSPITAL_ADMIN_PASSWORD",
      "PATIENT_IDENTIFIER",
      "PATIENT_PASSWORD",
      "CHW_IDENTIFIER",
      "CHW_PASSWORD",
    ];
    const originalValues = Object.fromEntries(
      envKeys.map((key) => [key, process.env[key]])
    );

    try {
      const env = {
        ...process.env,
        BASE_URL: "https://afya-link-hrms-4.vercel.app",
        FRONTEND_BASE_URL: "https://afya-link-hrms-4.vercel.app",
        BACKEND_BASE_URL: "https://afya-link-hrms-frontend-4.onrender.com",
        PROBE_LABEL: "test-no-creds",
        PROBE_REGION: "test-local",
        ROLE_FILTER: "SUPER_ADMIN,HOSPITAL_ADMIN",
        REQUIRED_ROLE_SUITES: "SUPER_ADMIN",
        SMOKE_SUMMARY_PATH: path.join(backendDir, "artifacts", "ops", "synthetic-live-smoke-summary.json"),
      };

      for (const key of envKeys) {
        delete env[key];
      }
      for (const key of [
        "BASE_URL",
        "FRONTEND_BASE_URL",
        "BACKEND_BASE_URL",
        "PROBE_LABEL",
        "PROBE_REGION",
        "ROLE_FILTER",
        "REQUIRED_ROLE_SUITES",
        "SMOKE_SUMMARY_PATH",
      ]) {
        env[key] = {
          BASE_URL: "https://afya-link-hrms-4.vercel.app",
          FRONTEND_BASE_URL: "https://afya-link-hrms-4.vercel.app",
          BACKEND_BASE_URL: "https://afya-link-hrms-frontend-4.onrender.com",
          PROBE_LABEL: "test-no-creds",
          PROBE_REGION: "test-local",
          ROLE_FILTER: "SUPER_ADMIN,HOSPITAL_ADMIN",
          REQUIRED_ROLE_SUITES: "SUPER_ADMIN",
          SMOKE_SUMMARY_PATH: path.join(backendDir, "artifacts", "ops", "synthetic-live-smoke-summary.json"),
        }[key];
      }

      for (const key of [
        "SUPER_ADMIN_IDENTIFIER",
        "SUPER_ADMIN_PASSWORD",
        "HOSPITAL_ADMIN_IDENTIFIER",
        "HOSPITAL_ADMIN_PASSWORD",
        "PATIENT_IDENTIFIER",
        "PATIENT_PASSWORD",
        "CHW_IDENTIFIER",
        "CHW_PASSWORD",
      ]) {
        delete env[key];
      }

      const result = spawnSync(process.execPath, [smokeScript], {
        cwd: backendDir,
        env,
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PASS live-smoke-suite");
      expect(result.stdout).toContain("[SKIP] SUPER_ADMIN: missing SUPER_ADMIN_IDENTIFIER/SUPER_ADMIN_PASSWORD");
    } finally {
      for (const key of envKeys) {
        const value = originalValues[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
