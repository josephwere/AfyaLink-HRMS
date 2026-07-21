export class EncounterParticipant {
  constructor({ id, role, connectionId }) {
    this.id = id;
    this.role = role;
    this.connectionId = connectionId;
    this.joinedAt = new Date().toISOString();
  }
}
