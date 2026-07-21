export class EncounterTimelineEntry {
  constructor({ type, state, actor, note, at }) {
    this.type = type;
    this.state = state;
    this.actor = actor;
    this.note = note;
    this.at = at || new Date().toISOString();
  }
}
