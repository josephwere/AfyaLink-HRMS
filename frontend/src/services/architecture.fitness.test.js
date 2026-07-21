import { describe, it, expect, beforeAll } from "vitest";

/**
 * Architecture Fitness Tests
 * 
 * These tests validate that the domain architecture adheres to key design rules.
 * They run as CI checks to prevent architectural drift.
 */

describe("Architectural Fitness", () => {
  let domainRegistry;

  beforeAll(async () => {
    // Import domain loader to trigger auto-registration
    await import("./domains/index.js");
    const registryModule = await import("./shared/domainRegistry.js");
    domainRegistry = registryModule.default || registryModule;
  });

  describe("Domain Registry Structure", () => {
    it("should expose runtime discovery for domain registration", async () => {
      const { registerAllDomains } = await import("./domains/index.js");
      expect(typeof registerAllDomains).toBe("function");
      const discoveryResult = registerAllDomains();
      expect(discoveryResult).toBeTruthy();
      expect(discoveryResult).toHaveLength(7);

      await Promise.all(discoveryResult);
      const registry = domainRegistry.getAllDomains();
      const names = registry.map((domain) => domain.name);
      expect(names).toContain("billing");
    });

    it("should initialize the frontend runtime from a single entrypoint", async () => {
      const { initializeFrontendRuntime, getRuntimeRoutes } = await import("./domains/index.js");
      const runtimeState = await initializeFrontendRuntime({ userPermissions: ["admin", "billing"] });
      expect(runtimeState.initialized).toBe(true);
      expect(runtimeState.modules.length).toBeGreaterThan(0);
      expect(getRuntimeRoutes().length).toBeGreaterThan(0);
    });

    it("should register a shared domain module contract", async () => {
      const pharmacyModule = (await import("./pharmacy/module.js")).default;
      domainRegistry.registerDomain(pharmacyModule);

      const registeredDomain = domainRegistry.getDomain("pharmacy");
      expect(registeredDomain).toBeTruthy();
      expect(registeredDomain.service).toBe(pharmacyModule.service);
      expect(registeredDomain.service.manifest.name).toBe("pharmacy");
    });

    it("should have all expected domains registered", () => {
      const domains = domainRegistry.getAllDomains();
      const names = domains.map((d) => d.name);

      expect(names).toContain("encounter");
      expect(names).toContain("pharmacy");
      expect(names).toContain("laboratory");
      expect(names).toContain("radiology");
      expect(names).toContain("workflow");
      expect(names).toContain("billing");
      expect(names).toContain("governance");
    });

    it("should have exactly 7 domains registered", () => {
      const domains = domainRegistry.getAllDomains();
      expect(domains).toHaveLength(7);
    });
  });

  describe("Domain Dependencies", () => {
    it("should validate all dependencies without errors", () => {
      const validation = domainRegistry.validateDependencies();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should have no circular dependencies", () => {
      const validation = domainRegistry.validateDependencies();
      expect(validation.valid).toBe(true);
    });

    it("should provide startup order", () => {
      const order = domainRegistry.getStartupOrder();
      expect(order).toBeTruthy();
      expect(order).toHaveLength(7);
      // Encounter should start first (no dependencies)
      expect(order[0]).toBe("encounter");
      // Workflow should start last (depends on everything)
      expect(order[order.length - 1]).toBe("workflow");
    });

    it("should correctly identify domain dependencies", () => {
      const graph = domainRegistry.getDependencyGraph();
      expect(graph.encounter).toEqual([]);
      expect(graph.pharmacy).toContain("encounter");
      expect(graph.laboratory).toContain("encounter");
      expect(graph.radiology).toContain("encounter");
      expect(graph.billing).toContain("encounter");
      expect(graph.workflow).toContain("encounter");
      expect(graph.workflow).toContain("laboratory");
      expect(graph.workflow).toContain("radiology");
      expect(graph.workflow).toContain("pharmacy");
      expect(graph.workflow).toContain("billing");
    });

    it("should validate that manifest dependencies point to registered domains", () => {
      const domains = domainRegistry.getAllDomains();
      const registeredNames = new Set(domains.map((domain) => domain.name));
      const graph = domainRegistry.getDependencyGraph();

      for (const [domainName, dependencies] of Object.entries(graph)) {
        for (const dependency of dependencies) {
          expect(registeredNames.has(dependency), `${domainName} depends on unknown domain ${dependency}`).toBe(true);
        }
      }
    });
  });

  describe("Domain Capabilities", () => {
    it("should report capabilities for all domains", () => {
      const capabilities = domainRegistry.getCapabilitySummary();
      expect(Object.keys(capabilities)).toHaveLength(7);
    });

    it("should mark workflow as orchestration domain", () => {
      const capabilities = domainRegistry.getCapabilitySummary();
      expect(capabilities.workflow.orchestration).toBe(true);
    });

    it("should identify realtime capability for workflow", () => {
      const capabilities = domainRegistry.getCapabilitySummary();
      expect(capabilities.workflow.realtime).toBe(true);
      // Other domains don't require realtime
      expect(capabilities.encounter.realtime).toBe(false);
    });

    it("should list all domains with query capability", () => {
      const capsByDomain = domainRegistry.getCapabilities();
      const withQuery = capsByDomain.query || [];
      expect(withQuery).toContain("encounter");
      expect(withQuery).toContain("pharmacy");
      expect(withQuery).toContain("laboratory");
      expect(withQuery).toContain("radiology");
      expect(withQuery).toContain("workflow");
      expect(withQuery).toContain("billing");
      expect(withQuery).toContain("governance");
    });
  });

  describe("Domain Metadata", () => {
    it("should expose navigation metadata from manifests", () => {
      const navigationItems = domainRegistry.getNavigationItems({ userPermissions: ["admin", "billing"] });
      const encounterItem = navigationItems.find((item) => item.id === "encounter");
      const billingItem = navigationItems.find((item) => item.id === "billing");

      expect(encounterItem).toBeTruthy();
      expect(encounterItem.label).toBe("Encounter");
      expect(encounterItem.route).toBe("/app/care/encounters/opd");
      expect(encounterItem.workspace).toBe("care");

      expect(billingItem).toBeTruthy();
      expect(billingItem.label).toBe("Billing");
      expect(billingItem.route).toBe("/app/revenue/billing/index");
      expect(billingItem.workspace).toBe("revenue");
    });

    it("should have version for all domains", () => {
      const versions = domainRegistry.getVersions();
      expect(versions.encounter).toBeTruthy();
      expect(versions.pharmacy).toBeTruthy();
      expect(versions.laboratory).toBeTruthy();
      expect(versions.radiology).toBeTruthy();
      expect(versions.workflow).toBeTruthy();
      expect(versions.billing).toBeTruthy();
    });

    it("should use semantic versioning", () => {
      const versions = domainRegistry.getVersions();
      const semverRegex = /^\d+\.\d+\.\d+$/;
      expect(versions.encounter).toMatch(semverRegex);
      expect(versions.pharmacy).toMatch(semverRegex);
      expect(versions.laboratory).toMatch(semverRegex);
      expect(versions.radiology).toMatch(semverRegex);
      expect(versions.workflow).toMatch(semverRegex);
      expect(versions.billing).toMatch(semverRegex);
    });

    it("should have owner for all domains", () => {
      const metadata = domainRegistry.getMetadata();
      for (const [name, data] of Object.entries(metadata)) {
        expect(data.owner).toBeTruthy();
      }
    });

    it("should have description for all domains", () => {
      const metadata = domainRegistry.getMetadata();
      for (const [name, data] of Object.entries(metadata)) {
        expect(data.description).toBeTruthy();
      }
    });
  });

  describe("Cross-Domain Orchestration", () => {
    it("workflow should depend on clinical domains", () => {
      const graph = domainRegistry.getDependencyGraph();
      const workflowDeps = graph.workflow;
      expect(workflowDeps).toContain("encounter");
      expect(workflowDeps).toContain("laboratory");
      expect(workflowDeps).toContain("radiology");
      expect(workflowDeps).toContain("pharmacy");
    });

    it("clinical domains should not depend on workflow", () => {
      const graph = domainRegistry.getDependencyGraph();
      expect(graph.encounter).not.toContain("workflow");
      expect(graph.pharmacy).not.toContain("workflow");
      expect(graph.laboratory).not.toContain("workflow");
      expect(graph.radiology).not.toContain("workflow");
      expect(graph.billing).not.toContain("workflow");
    });
  });
});
