export function scoreDoctorCandidate({ doctor, workload, specialtyMatch, preferred, languageMatch, insuranceMatch }) {
  let score = 0;
  score += workload || 0;
  score += specialtyMatch ? -10 : 0;
  score += preferred ? -20 : 0;
  score += languageMatch ? -5 : 0;
  score += insuranceMatch ? -5 : 0;
  return score;
}

export function chooseBestDoctor(candidates = []) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreDoctorCandidate(candidate),
    }))
    .sort((a, b) => a.score - b.score || a.workload - b.workload)
    .map((candidate) => candidate.doctor)[0] || null;
}

export function buildDoctorCandidates({ doctors, availabilityByDoctor, loadByDoctor, serviceType, patientPreferences = {} }) {
  return doctors.map((doctor) => {
    const availability = availabilityByDoctor.get(String(doctor._id));
    const appointmentsToday = Number(loadByDoctor.get(String(doctor._id)) || 0);
    const specialtyMatch = Boolean(
      serviceType && doctor?.employment?.department &&
      String(serviceType).toLowerCase().includes(String(doctor.employment.department).toLowerCase())
    );
    return {
      doctor,
      appointmentsToday,
      slots: Number(availability?.appointmentSlots || 9999),
      specialtyMatch,
      preferred: Boolean(patientPreferences.doctorId && String(doctor._id) === String(patientPreferences.doctorId)),
      languageMatch: Boolean(patientPreferences.language && doctor.metadata?.languages?.includes(patientPreferences.language)),
      insuranceMatch: Boolean(patientPreferences.insurance && doctor.metadata?.insurance?.includes(patientPreferences.insurance)),
    };
  });
}
