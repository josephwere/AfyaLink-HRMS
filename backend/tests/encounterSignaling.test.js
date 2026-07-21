import { EncounterSignalingService } from "../encounter/signaling/signalingService.js";

describe("Encounter Signaling", () => {
  test("registers peer connections and media sessions for an encounter", () => {
    const signaling = new EncounterSignalingService();
    const peer = signaling.registerPeer("enc-1", "doctor-1", "conn-doctor");
    const media = signaling.registerMediaSession("enc-1", "doctor-1", { localStream: true });

    expect(peer.participantId).toBe("doctor-1");
    expect(media.mediaState.localStream).toBe(true);
    expect(signaling.getPeerConnection("enc-1", "doctor-1")).toBeTruthy();
    expect(signaling.getMediaSession("enc-1", "doctor-1")).toBeTruthy();
  });
});
