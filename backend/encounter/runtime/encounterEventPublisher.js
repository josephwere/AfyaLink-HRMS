export class EncounterEventPublisher {
  constructor(publisher) {
    this.publisher = publisher;
  }

  publish(event) {
    if (this.publisher?.publish) {
      this.publisher.publish(event);
    }
  }
}
