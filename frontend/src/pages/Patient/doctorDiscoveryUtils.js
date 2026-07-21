export function filterDoctorsForDiscovery(doctors = [], filters = {}) {
  const specialty = String(filters.specialty || "").trim().toLowerCase();
  const language = String(filters.language || "").trim().toLowerCase();
  const gender = String(filters.gender || "").trim().toLowerCase();
  const availability = String(filters.availability || "").trim().toLowerCase();
  const consultationMode = String(filters.consultationMode || "").trim().toUpperCase();
  const insurance = String(filters.insurance || "").trim().toLowerCase();

  return doctors.filter((doctor) => {
    const doctorSpecialty = String(doctor?.specialization || doctor?.department || "").trim().toLowerCase();
    const doctorLanguages = (doctor?.languages || []).map((entry) => String(entry).trim().toLowerCase());
    const doctorGender = String(doctor?.gender || "").trim().toLowerCase();
    const doctorModes = (doctor?.consultationMode || []).map((entry) => String(entry).trim().toUpperCase());
    const doctorInsurance = Boolean(doctor?.insuranceAccepted || doctor?.acceptsInsurance);
    const onlineNow = Boolean(doctor?.availableToday || doctor?.onlineNow || doctor?.isOnline);

    if (specialty && doctorSpecialty && !doctorSpecialty.includes(specialty)) return false;
    if (language && !doctorLanguages.some((entry) => entry.includes(language))) return false;
    if (gender && doctorGender && !doctorGender.includes(gender)) return false;
    if (availability === "available" && !onlineNow) return false;
    if (availability === "busy" && onlineNow) return false;
    if (consultationMode && doctorModes.length && !doctorModes.includes(consultationMode)) return false;
    if (insurance === "accepted" && !doctorInsurance) return false;
    if (insurance === "not-accepted" && doctorInsurance) return false;
    return true;
  });
}

export function getDoctorRecommendation(doctor = {}, index = 0) {
  const score = Math.max(84, Math.min(99, 88 + (doctor?.availableToday ? 3 : 0) + (doctor?.insuranceAccepted ? 2 : 0) + (index % 2 === 0 ? 1 : 0)));
  const reasons = [];
  if (doctor?.availableToday) reasons.push("Best match for today");
  if (doctor?.insuranceAccepted) reasons.push("Insurance accepted");
  if (doctor?.consultationMode?.includes("VIDEO") || doctor?.consultationMode?.includes("VOICE")) reasons.push("Video or voice available");
  if (doctor?.yearsOfExperience >= 10) reasons.push("Experienced clinician");
  if (!reasons.length) reasons.push("Recommended today");
  return { score, reasons: reasons.slice(0, 4) };
}
