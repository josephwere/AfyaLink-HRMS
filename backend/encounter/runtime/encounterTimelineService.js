import { EncounterTimelineEntry } from "../models/EncounterTimeline.js";

export class EncounterTimelineService {
  append(encounter, entry) {
    const timelineEntry = new EncounterTimelineEntry(entry);
    encounter.timeline = encounter.timeline || [];
    encounter.timeline.push(timelineEntry);
    return timelineEntry;
  }
}
