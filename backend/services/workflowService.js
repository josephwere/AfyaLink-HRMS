import Appointment from "../models/Appointment.js";
import Encounter from "../models/Encounter.js";
import { v4 as uuid } from "uuid";

class WorkflowService {
  /**
   * START a workflow (entry point)
   */
  async start(type, context) {
    if (type !== "CONSULTATION") {
      throw new Error("Unsupported workflow type");
    }

    const workflowId = uuid();

    const appointment = await Appointment.create({
      ...context,
      workflowId,
      status: "CONSULTATION",
    });

    return {
      id: workflowId,
      state: "CONSULTATION",
      context: { appointment },
    };
  }

  /**
   * TRANSITION a workflow
   */
  async transition(type, workflowId, { updates = {}, cancel = false }) {
    if (type !== "CONSULTATION") {
      throw new Error("Unsupported workflow type");
    }

    const appointment = await Appointment.findOne({ workflowId });
    if (!appointment) throw new Error("Workflow not found");

    if (cancel) {
      appointment.status = "CANCELLED";
    } else {
      Object.assign(appointment, updates);
    }

    await appointment.save();

    return {
      id: workflowId,
      state: appointment.status,
      context: { appointment },
    };
  }

  /**
   * ENCOUNTER-level transition (clinical)
   */
  async transitionEncounter(encounterId, nextState, payload = {}) {
    const encounter = await Encounter.findById(encounterId);
    if (!encounter) throw new Error("Encounter not found");

    encounter.state = nextState;

    if (payload.notes) encounter.consultationNotes = payload.notes;
    if (payload.diagnosis) encounter.diagnosis = payload.diagnosis;
    if (payload.labOrderId) encounter.labOrders.push(payload.labOrderId);
    if (payload.prescriptionId) {
      encounter.prescriptions.push(payload.prescriptionId);
    }
    if (payload.billId) encounter.bill = payload.billId;

    if (nextState === "CLOSED") {
      encounter.closedAt = new Date();
    }

    await encounter.save();
    return encounter;
  }
}

/**
 * ✅ CREATE INSTANCE
 */
const workflowService = new WorkflowService();

/**
 * ✅ EXPORT BOTH (THIS IS THE FIX)
 */
export { workflowService };
export default workflowService;
