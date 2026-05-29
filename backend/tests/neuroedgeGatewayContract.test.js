import fs from "fs";
import path from "path";

const repoRoot = path.resolve(process.cwd(), "..");
const openApiPath = path.join(repoRoot, "frontend", "docs", "neuroedge-openapi.yaml");
const routesPath = path.join(process.cwd(), "routes", "aiGatewayRoutes.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

describe("NeuroEdge contract coverage", () => {
  test("OpenAPI includes required NeuroEdge upstream paths", () => {
    const yaml = read(openApiPath);
    const required = [
      "/health:",
      "/v1/chat/completions:",
      "/v1/chat/stream:",
      "/v1/feedback:",
      "/v1/extract:",
      "/v1/ingest/document:",
      "/v1/search:",
      "/v1/interop/fhir/transform:",
      "/v1/interop/hl7/transform:",
      "/v1/risk/staffing-forecast:",
      "/v1/risk/burnout-score:",
      "/v1/risk/causal-impact:",
      "/v1/simulation/digital-twin:",
      "/v1/jobs/{jobId}:",
      "/v1/guardrails/authorize:",
    ];
    for (const entry of required) {
      expect(yaml).toContain(entry);
    }
  });

  test("AfyaLink gateway routes include required external endpoints", () => {
    const src = read(routesPath);
    const required = [
      '"/extract"',
      '"/ingest"',
      '"/search"',
      '"/fhir-transform"',
      '"/hl7-transform"',
      '"/risk/staffing-forecast"',
      '"/risk/burnout-score"',
      '"/risk/causal-impact"',
      '"/simulate/digital-twin"',
      '"/jobs/:jobId"',
      '"/health"',
    ];
    for (const entry of required) {
      expect(src).toContain(entry);
    }
  });

  test("AfyaLink assistant routes expose stream and feedback", () => {
    const assistantRoutes = read(path.join(process.cwd(), "routes", "aiRoutes.js"));
    const required = ['"/assistant/chat/stream"', '"/assistant/feedback"'];
    for (const entry of required) {
      expect(assistantRoutes).toContain(entry);
    }
  });
});
