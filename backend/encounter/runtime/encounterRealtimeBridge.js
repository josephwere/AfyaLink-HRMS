import { getIO } from "../../utils/socket.js";

export function broadcastEncounterEvent(event) {
  try {
    const io = getIO();
    if (!io) return null;
    const encounterId = event?.encounterId || event?.encounter?.id;
    if (!encounterId) return null;
    io.to(String(encounterId)).emit("encounter:event", event);
    return event;
  } catch {
    return null;
  }
}
