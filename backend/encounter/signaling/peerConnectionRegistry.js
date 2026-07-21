export class PeerConnectionRegistry {
  constructor() {
    this.connections = new Map();
  }

  add({ encounterId, participantId, connectionId }) {
    const key = `${encounterId}:${participantId}`;
    this.connections.set(key, { encounterId, participantId, connectionId, createdAt: new Date().toISOString() });
    return this.connections.get(key);
  }

  get(encounterId, participantId) {
    return this.connections.get(`${encounterId}:${participantId}`) || null;
  }

  remove(encounterId, participantId) {
    this.connections.delete(`${encounterId}:${participantId}`);
  }
}
