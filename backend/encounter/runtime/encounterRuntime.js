import { buildEncounterEvent, ENCOUNTER_EVENT_TYPES } from "../contracts/encounterEventSchema.js";
import { encounterContract } from "../contracts/encounterContract.js";
import { participantContract } from "../contracts/participantContract.js";
import { presenceContract } from "../contracts/presenceContract.js";
import { canTransition, ENCOUNTER_STATES } from "./encounterStateMachine.js";
import { EncounterEventPublisher } from "./encounterEventPublisher.js";
import { EncounterPresenceService } from "./encounterPresenceService.js";
import { EncounterTimelineService } from "./encounterTimelineService.js";
import { broadcastEncounterEvent } from "./encounterRealtimeBridge.js";
import { EncounterWorkflowCoordinator } from "./encounterWorkflowCoordinator.js";

export function createEncounterRuntime({ publisher, workflowCoordinator, observability, repository } = {}) {
  const eventPublisher = new EncounterEventPublisher(publisher);
  const presenceService = new EncounterPresenceService();
  const timelineService = new EncounterTimelineService();
  const coordinator = workflowCoordinator || new EncounterWorkflowCoordinator();
  const encountersById = new Map();
  const persistence = repository || null;

  async function persistEncounter(encounter, overrides = {}) {
    if (!persistence) return encounter;
    const persisted = await persistence.save?.(encounter, overrides);
    if (persisted) return persisted;
    return encounter;
  }

  return {
    createEncounter({ patientId, doctorId, mode, externalId, hospitalId, metadata }) {
      const encounter = {
        id: `enc-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        patientId,
        doctorId,
        mode,
        state: ENCOUNTER_STATES.CREATED,
        version: 0,
        externalId,
        hospitalId,
        metadata: metadata || {},
        timeline: [],
        createdAt: new Date().toISOString(),
      };

      encountersById.set(encounter.id, encounter);
      if (externalId) {
        encountersById.set(String(externalId), encounter);
      }

      timelineService.append(encounter, {
        type: "STATE",
        state: encounter.state,
        at: encounter.createdAt,
        note: "Encounter created",
      });

      const createdEvent = buildEncounterEvent(ENCOUNTER_EVENT_TYPES.CREATED, { encounterId: encounter.id, encounter: encounterContract(encounter) });
      observability?.emit?.("encounter.created", { encounterId: encounter.id, state: encounter.state, mode: encounter.mode });
      eventPublisher.publish(createdEvent);
      broadcastEncounterEvent(createdEvent);
      coordinator.handleCreate({ encounter });
      void persistEncounter(encounter, { source: "create" });
      return encounter;
    },

    transitionEncounter(encounter, { to, actor, note, expectedVersion }) {
      if (encounter.state === to) {
        return encounter;
      }

      if (!canTransition(encounter.state, to)) {
        throw new Error(`Invalid transition from ${encounter.state} to ${to}`);
      }

      if (expectedVersion !== undefined && encounter.version !== expectedVersion) {
        throw new Error(`Concurrent modification: expected version ${expectedVersion} but found ${encounter.version}`);
      }

      if (encounter.state === to) {
        return encounter;
      }

      const previousState = encounter.state;
      encounter.state = to;
      encounter.version += 1;
      timelineService.append(encounter, {
        type: "STATE",
        state: encounter.state,
        actor,
        note,
        at: new Date().toISOString(),
      });

      const transitionedEvent = buildEncounterEvent(ENCOUNTER_EVENT_TYPES.TRANSITIONED, { encounterId: encounter.id, encounter: encounterContract(encounter), actor, note, trace: { previousState, nextState: to, version: encounter.version } });
      observability?.emit?.("encounter.transitioned", { encounterId: encounter.id, previousState, nextState: to, actor, note, version: encounter.version });
      eventPublisher.publish(transitionedEvent);
      broadcastEncounterEvent(transitionedEvent);
      coordinator.handleTransition({ encounter, actor, note });
      if (to === ENCOUNTER_STATES.CLOSED) {
        const closedEvent = buildEncounterEvent(ENCOUNTER_EVENT_TYPES.CLOSED, { encounterId: encounter.id, encounter: encounterContract(encounter) });
        eventPublisher.publish(closedEvent);
        broadcastEncounterEvent(closedEvent);
      }

      void persistEncounter(encounter, { source: "transition" });
      return { ...encounter, previousState };
    },

    joinPresence(encounterId, participant) {
      const normalized = participantContract(participant);
      const participants = presenceService.join(encounterId, normalized);
      const encounter = encountersById.get(String(encounterId)) || encountersById.get(encounterId);
      if (encounter) {
        timelineService.append(encounter, {
          type: "PARTICIPANT_JOINED",
          actor: normalized.id,
          note: `${normalized.role || "Participant"} joined the encounter`,
          at: new Date().toISOString(),
        });
      }
      const presenceEvent = buildEncounterEvent("ENCOUNTER_PARTICIPANT_JOINED", {
        trace: { encounterId, participantId: normalized.id },
        encounterId,
        presence: presenceContract({ encounterId, participants }),
      });
      observability?.emit?.("encounter.presence.joined", { encounterId, participantId: normalized.id, participants: participants.length });
      eventPublisher.publish(presenceEvent);
      broadcastEncounterEvent(presenceEvent);
      void persistEncounter(encounter, { source: "presence" });
      return participants;
    },

    listPresence(encounterId) {
      return presenceService.list(encounterId);
    },
  };
}
