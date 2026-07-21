export class MediaSessionRegistry {
  constructor() {
    this.sessions = new Map();
  }

  add({ encounterId, participantId, mediaState = {} }) {
    const key = `${encounterId}:${participantId}`;
    const session = {
      encounterId,
      participantId,
      mediaState,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(key, session);
    return session;
  }

  get(encounterId, participantId) {
    return this.sessions.get(`${encounterId}:${participantId}`) || null;
  }

  remove(encounterId, participantId) {
    this.sessions.delete(`${encounterId}:${participantId}`);
  }
}
