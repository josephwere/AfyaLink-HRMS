import { describe, it, expect, beforeAll } from "vitest";

/**
 * Domain Contract Test Suite
 * 
 * Every registered domain must satisfy these contracts:
 * - Manifest exists with required metadata
 * - Queries and commands are exported
 * - Permissions are defined
 * - Events are defined
 * - Cache invalidation rules exist
 * - Registration succeeds
 * 
 * This test runs automatically for all registered domains.
 */

describe("Domain Contracts", () => {
  let domainRegistry;

  beforeAll(async () => {
    // Import domain loader to trigger auto-registration
    await import("./domains/index.js");
    // Now import registry
    const registryModule = await import("./shared/domainRegistry.js");
    domainRegistry = registryModule.default || registryModule;
  });

  it("should have at least one registered domain", () => {
    const domains = domainRegistry.getAllDomains();
    expect(domains.length).toBeGreaterThan(0);
  });

  it("should load all domains before running contract tests", async () => {
    const domains = domainRegistry.getAllDomains();
    expect(domains.length).toBeGreaterThanOrEqual(2); // At least Encounter and Pharmacy
  });
});

describe("Domain Contract: Encounter", async () => {
  let service;
  let domain;

  beforeAll(async () => {
    // Import domain loader to trigger auto-registration
    await import("./domains/index.js");
    const registryModule = await import("./shared/domainRegistry.js");
    const registry = registryModule.default || registryModule;
    domain = registry.getDomain("encounter");
    service = domain?.service;
  });

  if (!service) {
    it("should have Encounter domain registered", () => {
      expect(service).toBeTruthy();
    });
  } else {
    it("should have valid metadata", () => {
      expect(service.manifest).toBeTruthy();
      expect(service.manifest.name).toBe("encounter");
      expect(service.manifest.version).toBeTruthy();
      expect(service.manifest.owner).toBeTruthy();
    });

    it("should export queries", () => {
      expect(service.queries).toBeTruthy();
      const queryNames = Object.keys(service.queries);
      expect(queryNames.length).toBeGreaterThan(0);
    });

    it("should export commands", () => {
      expect(service.commands).toBeTruthy();
      const commandNames = Object.keys(service.commands);
      expect(commandNames.length).toBeGreaterThan(0);
    });

    it("should define permissions", () => {
      expect(service.permissions).toBeTruthy();
      expect(Object.keys(service.permissions).length).toBeGreaterThan(0);
    });

    it("should expose events bus", () => {
      expect(service.events).toBeTruthy();
      expect(typeof service.events.on).toBe("function");
      expect(typeof service.events.emit).toBe("function");
    });

    it("should define cache invalidation rules", () => {
      expect(service.cache).toBeTruthy();
      expect(Object.keys(service.cache).length).toBeGreaterThan(0);
    });

    it("should have runtime metadata", () => {
      expect(service.runtime).toBeTruthy();
      expect(service.runtime.version).toBeTruthy();
    });
  }
});

describe("Domain Contract: Pharmacy", async () => {
  let service;
  let domain;

  beforeAll(async () => {
    // Import domain loader to trigger auto-registration
    await import("./domains/index.js");
    const registryModule = await import("./shared/domainRegistry.js");
    const registry = registryModule.default || registryModule;
    domain = registry.getDomain("pharmacy");
    service = domain?.service;
  });

  if (!service) {
    it("should have Pharmacy domain registered", () => {
      expect(service).toBeTruthy();
    });
  } else {
    it("should have valid metadata", () => {
      expect(service.manifest).toBeTruthy();
      expect(service.manifest.name).toBe("pharmacy");
      expect(service.manifest.version).toBeTruthy();
      expect(service.manifest.owner).toBeTruthy();
    });

    it("should export queries", () => {
      expect(service.queries).toBeTruthy();
      const queryNames = Object.keys(service.queries);
      expect(queryNames.length).toBeGreaterThan(0);
    });

    it("should export commands", () => {
      expect(service.commands).toBeTruthy();
      const commandNames = Object.keys(service.commands);
      expect(commandNames.length).toBeGreaterThan(0);
    });

    it("should define permissions", () => {
      expect(service.permissions).toBeTruthy();
      expect(Object.keys(service.permissions).length).toBeGreaterThan(0);
    });

    it("should expose events bus", () => {
      expect(service.events).toBeTruthy();
      expect(typeof service.events.on).toBe("function");
      expect(typeof service.events.emit).toBe("function");
    });

    it("should define cache invalidation rules", () => {
      expect(service.cache).toBeTruthy();
      expect(Object.keys(service.cache).length).toBeGreaterThan(0);
    });

    it("should have runtime metadata", () => {
      expect(service.runtime).toBeTruthy();
      expect(service.runtime.version).toBeTruthy();
    });
  }
});

describe("Domain Contract: Billing", async () => {
  let service;
  let domain;

  beforeAll(async () => {
    await import("./domains/index.js");
    const registryModule = await import("./shared/domainRegistry.js");
    const registry = registryModule.default || registryModule;
    domain = registry.getDomain("billing");
    service = domain?.service;
  });

  if (!service) {
    it("should have Billing domain registered", () => {
      expect(service).toBeTruthy();
    });
  } else {
    it("should have valid metadata", () => {
      expect(service.manifest).toBeTruthy();
      expect(service.manifest.name).toBe("billing");
      expect(service.manifest.version).toBeTruthy();
      expect(service.manifest.owner).toBeTruthy();
    });

    it("should export queries", () => {
      expect(service.queries).toBeTruthy();
      const queryNames = Object.keys(service.queries);
      expect(queryNames.length).toBeGreaterThan(0);
    });

    it("should export commands", () => {
      expect(service.commands).toBeTruthy();
      const commandNames = Object.keys(service.commands);
      expect(commandNames.length).toBeGreaterThan(0);
    });

    it("should define permissions", () => {
      expect(service.permissions).toBeTruthy();
      expect(Object.keys(service.permissions).length).toBeGreaterThan(0);
    });

    it("should expose events bus", () => {
      expect(service.events).toBeTruthy();
      expect(typeof service.events.on).toBe("function");
      expect(typeof service.events.emit).toBe("function");
    });

    it("should define cache invalidation rules", () => {
      expect(service.cache).toBeTruthy();
      expect(Object.keys(service.cache).length).toBeGreaterThan(0);
    });

    it("should have runtime metadata", () => {
      expect(service.runtime).toBeTruthy();
      expect(service.runtime.version).toBeTruthy();
    });
  }
});

