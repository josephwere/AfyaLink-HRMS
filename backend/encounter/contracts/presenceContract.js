export function presenceContract({ encounterId, participants = [] }) {
  return {
    encounterId,
    participants,
  };
}
