import { getAllowedOrigins, isAllowedOrigin } from "../utils/corsOrigins.js";

describe("CORS origin policy", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows the exact local Playwright origin in non-production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_PUBLIC_URL;

    expect(getAllowedOrigins()).toContain("http://127.0.0.1:5173");
    expect(isAllowedOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(isAllowedOrigin("http://malicious.example")).toBe(false);
  });

  it("keeps local origins rejected in production unless explicitly configured", () => {
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_PUBLIC_URL;

    expect(getAllowedOrigins()).toContain("https://afya-link-hrms-4.vercel.app");
    expect(isAllowedOrigin("https://afya-link-hrms-4.vercel.app")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:5173")).toBe(false);
    expect(isAllowedOrigin("https://example.invalid")).toBe(false);
    process.env.CORS_ORIGIN = "https://app.example";
    expect(isAllowedOrigin("https://app.example")).toBe(true);
  });
});