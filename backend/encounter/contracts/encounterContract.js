export function encounterContract(encounter) {
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    doctorId: encounter.doctorId,
    mode: encounter.mode,
    state: encounter.state,
    timeline: encounter.timeline || [],
    createdAt: encounter.createdAt,
  };
}
