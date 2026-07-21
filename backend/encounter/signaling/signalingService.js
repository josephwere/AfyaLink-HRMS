import { getIO } from "../../utils/socket.js";

export class EncounterSignalingService {
  constructor() {
    this.peerConnections = new Map();
    this.mediaSessions = new Map();
  }

  registerPeer(encounterId, participantId, connectionId) {
    const sessionKey = `${encounterId}:${participantId}`;
    this.peerConnections.set(sessionKey, {
      encounterId,
      participantId,
      connectionId,
      createdAt: new Date().toISOString(),
    });
    return this.peerConnections.get(sessionKey);
  }

  registerMediaSession(encounterId, participantId, mediaState = {}) {
    const sessionKey = `${encounterId}:${participantId}`;
    const session = {
      encounterId,
      participantId,
      mediaState,
      updatedAt: new Date().toISOString(),
    };
    this.mediaSessions.set(sessionKey, session);
    return session;
  }

  async relaySignal({ encounterId, participantId, targetParticipantId, signalType, payload }) {
    const io = getIO();
    const roomKey = `encounter:${String(encounterId)}`;
    io.to(roomKey).emit("encounter:signal", {
      encounterId: String(encounterId),
      participantId: String(participantId),
      targetParticipantId: String(targetParticipantId),
      signalType,
      payload,
      relayedAt: new Date().toISOString(),
    });
  }

  getPeerConnection(encounterId, participantId) {
    return this.peerConnections.get(`${encounterId}:${participantId}`) || null;
  }

  getMediaSession(encounterId, participantId) {
    return this.mediaSessions.get(`${encounterId}:${participantId}`) || null;
  }
}
