import { createEncounterRuntime } from "../encounter/runtime/encounterRuntime.js";
import { ENCOUNTER_STATES } from "../encounter/runtime/encounterStateMachine.js";
import { EncounterPresenceService } from "../encounter/runtime/encounterPresenceService.js";
import { EncounterWorkflowCoordinator } from "../encounter/runtime/encounterWorkflowCoordinator.js";
import { encounterRepository } from "../encounter/repositories/encounterRepository.js";

describe("Encounter Runtime", () => {
  test("creates and transitions encounters while publishing lifecycle events", () => {
    const published = [];
    const runtime = createEncounterRuntime({
      publisher: {
        publish(event) {
          published.push(event);
        },
      },
    });

    const encounter = runtime.createEncounter({
      patientId: "patient-1",
      doctorId: "doctor-1",
      mode: "telemedicine",
    });

    expect(encounter.state).toBe(ENCOUNTER_STATES.CREATED);
    expect(encounter.mode).toBe("telemedicine");

    const transitioned = runtime.transitionEncounter(encounter, {
      to: ENCOUNTER_STATES.CONSULTING,
      actor: "doctor-1",
      note: "Started consultation",
    });

    expect(transitioned.state).toBe(ENCOUNTER_STATES.CONSULTING);
    expect(transitioned.timeline).toHaveLength(2);
    expect(published.map((event) => event.type)).toEqual([
      "ENCOUNTER_CREATED",
      "ENCOUNTER_TRANSITIONED",
    ]);
  });

  test("invokes workflow coordination for create and transition events", () => {
    const workflowRuns = [];
    const runtime = createEncounterRuntime({
      publisher: {
        publish() {},
      },
      workflowCoordinator: new EncounterWorkflowCoordinator({
        onCreate: ({ encounter }) => workflowRuns.push(`create:${encounter.mode}`),
        onTransition: ({ encounter, actor }) => workflowRuns.push(`transition:${encounter.state}:${actor}`),
      }),
    });

    const encounter = runtime.createEncounter({
      patientId: "patient-1",
      doctorId: "doctor-1",
      mode: "telemedicine",
    });

    runtime.transitionEncounter(encounter, {
      to: ENCOUNTER_STATES.CONSULTING,
      actor: "doctor-1",
      note: "Started consultation",
    });

    expect(workflowRuns).toEqual(["create:telemedicine", "transition:CONSULTING:doctor-1"]);
  });

  test("rejects invalid transitions through the runtime state machine", () => {
    const runtime = createEncounterRuntime({ publisher: { publish() {} } });
    const encounter = runtime.createEncounter({ patientId: "patient-1", doctorId: "doctor-1", mode: "in-person" });

    runtime.transitionEncounter(encounter, { to: ENCOUNTER_STATES.CLOSED, actor: "doctor-1" });

    expect(() => runtime.transitionEncounter(encounter, { to: ENCOUNTER_STATES.CONSULTING, actor: "doctor-1" })).toThrow(/Invalid transition/);
  });

  test("automatically appends timeline entries for creation and participant joins", () => {
    const runtime = createEncounterRuntime({ publisher: { publish() {} } });
    const encounter = runtime.createEncounter({ patientId: "patient-1", doctorId: "doctor-1", mode: "telemedicine" });

    runtime.joinPresence(encounter.id, { id: "doctor-1", role: "DOCTOR", connectionId: "conn-1" });

    expect(encounter.timeline).toHaveLength(2);
    expect(encounter.timeline.map((entry) => entry.type)).toEqual(["STATE", "PARTICIPANT_JOINED"]);
  });

  test("rejects duplicate participant joins for the same encounter", () => {
    const runtime = createEncounterRuntime({ publisher: { publish() {} } });
    const encounter = runtime.createEncounter({ patientId: "patient-1", doctorId: "doctor-1", mode: "telemedicine" });

    runtime.joinPresence(encounter.id, { id: "doctor-1", role: "DOCTOR", connectionId: "conn-1" });
    const secondJoin = runtime.joinPresence(encounter.id, { id: "doctor-1", role: "DOCTOR", connectionId: "conn-1" });

    expect(secondJoin).toHaveLength(1);
  });

  test("treats repeated transitions to the same state as idempotent no-ops", () => {
    const published = [];
    const runtime = createEncounterRuntime({
      publisher: {
        publish(event) {
          published.push(event);
        },
      },
    });
    const encounter = runtime.createEncounter({ patientId: "patient-1", doctorId: "doctor-1", mode: "telemedicine" });

    const first = runtime.transitionEncounter(encounter, { to: ENCOUNTER_STATES.CONSULTING, actor: "doctor-1", note: "Started consultation" });
    const second = runtime.transitionEncounter(encounter, { to: ENCOUNTER_STATES.CONSULTING, actor: "doctor-1", note: "Started consultation again" });

    expect(first.state).toBe(ENCOUNTER_STATES.CONSULTING);
    expect(second.state).toBe(ENCOUNTER_STATES.CONSULTING);
    expect(encounter.timeline).toHaveLength(2);
    expect(published.map((event) => event.type)).toEqual(["ENCOUNTER_CREATED", "ENCOUNTER_TRANSITIONED"]);
  });

  test("rejects stale transition requests with optimistic version guards", () => {
    const runtime = createEncounterRuntime({ publisher: { publish() {} } });
    const encounter = runtime.createEncounter({ patientId: "patient-1", doctorId: "doctor-1", mode: "telemedicine" });

    runtime.transitionEncounter(encounter, { to: ENCOUNTER_STATES.CONSULTING, actor: "doctor-1", note: "Started consultation", expectedVersion: 0 });

    expect(() => runtime.transitionEncounter(encounter, { to: ENCOUNTER_STATES.CLOSED, actor: "doctor-1", note: "Close", expectedVersion: 0 })).toThrow(/Concurrent modification/);
  });

  test("emits observability traces for creation and transition events", () => {
    const traces = [];
    const runtime = createEncounterRuntime({
      publisher: { publish() {} },
      observability: {
        emit(event, payload) {
          traces.push({ event, payload });
        },
      },
    });
    const encounter = runtime.createEncounter({ patientId: "patient-1", doctorId: "doctor-1", mode: "telemedicine" });

    runtime.transitionEncounter(encounter, { to: ENCOUNTER_STATES.CONSULTING, actor: "doctor-1", note: "Started consultation" });

    expect(traces.map((trace) => trace.event)).toEqual(["encounter.created", "encounter.transitioned"]);
  });

  test("registers presence for participants and exposes active membership", () => {
    const presenceService = new EncounterPresenceService();
    const doctor = { id: "doctor-1", role: "DOCTOR", connectionId: "conn-1" };
    const patient = { id: "patient-1", role: "PATIENT", connectionId: "conn-2" };

    presenceService.join("enc-1", doctor);
    presenceService.join("enc-1", patient);

    const members = presenceService.list("enc-1");

    expect(members).toHaveLength(2);
    expect(members.map((member) => member.id)).toEqual(["doctor-1", "patient-1"]);
  });

  test("persists encounters through the repository adapter while emitting lifecycle events", () => {
    const published = [];
    const saveCalls = [];
    const runtime = createEncounterRuntime({
      publisher: { publish(event) { published.push(event); } },
      repository: {
        async save(encounter) {
          saveCalls.push({ state: encounter.state, id: encounter.id });
          return encounter;
        },
      },
    });

    const encounter = runtime.createEncounter({
      patientId: "patient-1",
      doctorId: "doctor-1",
      mode: "telemedicine",
      hospitalId: "hospital-1",
    });

    runtime.transitionEncounter(encounter, {
      to: ENCOUNTER_STATES.CONSULTING,
      actor: "doctor-1",
      note: "Started consultation",
    });

    expect(encounter.state).toBe(ENCOUNTER_STATES.CONSULTING);
    expect(saveCalls).toHaveLength(2);
    expect(published.map((event) => event.type)).toEqual(["ENCOUNTER_CREATED", "ENCOUNTER_TRANSITIONED"]);
  });
});
