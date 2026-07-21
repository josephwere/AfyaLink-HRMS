export class EncounterWorkflowCoordinator {
  constructor({ onCreate, onTransition, workflowService, eventGateway } = {}) {
    this.onCreate = onCreate;
    this.onTransition = onTransition;
    this.workflowService = workflowService;
    this.eventGateway = eventGateway;
  }

  async handleCreate({ encounter }) {
    if (typeof this.onCreate === "function") {
      this.onCreate({ encounter });
    }

    void this.emitOperationalEvent({
      type: "ENCOUNTER_CREATED",
      source: "encounter-runtime",
      actor: encounter.doctorId || null,
      entity: "encounter",
      payload: {
        encounterId: encounter.id,
        externalId: encounter.externalId || null,
        mode: encounter.mode,
        state: encounter.state,
      },
    });

    if (encounter.externalId) {
      await this.triggerWorkflowTransition(encounter, encounter.state);
    }
  }

  async handleTransition({ encounter, actor, note }) {
    if (typeof this.onTransition === "function") {
      this.onTransition({ encounter, actor, note });
    }

    void this.emitOperationalEvent({
      type: "ENCOUNTER_TRANSITIONED",
      source: "encounter-runtime",
      actor,
      entity: "encounter",
      payload: {
        encounterId: encounter.id,
        externalId: encounter.externalId || null,
        mode: encounter.mode,
        state: encounter.state,
        note,
      },
    });

    if (encounter.externalId) {
      await this.triggerWorkflowTransition(encounter, encounter.state);
    }
  }

  async triggerWorkflowTransition(encounter, state) {
    try {
      const service = this.workflowService || (await import("../../services/workflowService.js")).default;
      await service.transitionEncounter(String(encounter.externalId), this.mapRuntimeStateToWorkflowState(state), {
        notes: encounter?.timeline?.slice(-1)?.[0]?.note || undefined,
      });
    } catch (error) {
      // optional workflow integration should not break encounter transitions
    }
  }

  async emitOperationalEvent(event) {
    if (typeof this.eventGateway === "function") {
      try {
        await this.eventGateway(event);
      } catch {
        // optional event fanout should not break encounter transitions
      }
    }
  }

  mapRuntimeStateToWorkflowState(state) {
    const mapping = {
      CREATED: "CREATED",
      CONSULTING: "CONSULTING",
      CLOSED: "CLOSED",
    };
    return mapping[state] || state;
  }
}
