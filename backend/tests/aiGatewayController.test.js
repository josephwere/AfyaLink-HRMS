import { __aiGatewayInternals } from "../controllers/aiGatewayController.js";

describe("aiGatewayController internals", () => {
  test("sanitizeTransformPayload keeps only consent-scoped fields", () => {
    const payload = {
      patient: { id: "p1" },
      encounter: { id: "e1" },
      billing: { invoice: "i1" },
      random: "drop",
    };
    const out = __aiGatewayInternals.sanitizeTransformPayload(payload, ["demographics", "encounters"]);
    expect(out).toEqual({
      patient: { id: "p1" },
      encounter: { id: "e1" },
    });
  });

  test("sanitizeTransformPayload returns null when no allowed fields remain", () => {
    const payload = { unknownField: true };
    const out = __aiGatewayInternals.sanitizeTransformPayload(payload, ["labs"]);
    expect(out).toBeNull();
  });

  test("validateRequest enforces extract required fields", () => {
    const errors = __aiGatewayInternals.validateRequest("extract", {
      source: { uri: "s3://demo" },
    });
    expect(errors).toContain("tenantId is required");
    expect(errors).toContain("source.mimeType is required");
  });

  test("validateRequest accepts valid fhir-transform payload", () => {
    const errors = __aiGatewayInternals.validateRequest("fhir-transform", {
      tenantId: "tenant-1",
      hospitalId: "h-1",
      actor: { userId: "u-1", role: "DOCTOR" },
      resourceType: "Patient",
      payload: { patient: { id: "p1" } },
    });
    expect(errors).toEqual([]);
  });

  test("maskSensitiveFields redacts disallowed patient fields", () => {
    const input = {
      patientName: "Jane Doe",
      phone: "+254...",
      lab: { result: "Positive" },
    };
    const masked = __aiGatewayInternals.maskSensitiveFields(input, ["labs"]);
    expect(masked.patientName).toBe("***REDACTED***");
    expect(masked.phone).toBe("***REDACTED***");
    expect(masked.lab.result).toBe("Positive");
  });

  test("normalizeScopes lowercases and trims", () => {
    const out = __aiGatewayInternals.normalizeScopes([" Labs ", "DEMOGRAPHICS", "", null]);
    expect(out).toEqual(["labs", "demographics"]);
  });

  test("getBodyIdempotencyKey reads header fallback", () => {
    const req = {
      body: {},
      headers: { "idempotency-key": "idem-1" },
    };
    expect(__aiGatewayInternals.getBodyIdempotencyKey(req)).toBe("idem-1");
  });

  test("getIdempotencyCacheKey is deterministic by endpoint+actor+key", () => {
    const req = { user: { _id: "abc123" } };
    const keyA = __aiGatewayInternals.getIdempotencyCacheKey(req, "extract", "idem-x");
    const keyB = __aiGatewayInternals.getIdempotencyCacheKey(req, "extract", "idem-x");
    expect(keyA).toBe(keyB);
    expect(keyA).toContain("ai:gateway:idem:extract:abc123:idem-x");
  });
});
