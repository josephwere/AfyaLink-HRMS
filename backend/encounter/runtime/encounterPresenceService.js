export class EncounterPresenceService {
  constructor() {
    this.presence = new Map();
  }

  join(encounterId, participant) {
    const bucket = this.presence.get(encounterId) || [];
    const exists = bucket.some((entry) => entry?.id === participant?.id);
    if (exists) {
      return bucket;
    }

    bucket.push(participant);
    this.presence.set(encounterId, bucket);
    return bucket;
  }

  list(encounterId) {
    return this.presence.get(encounterId) || [];
  }
}
