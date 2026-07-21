export function parseTimeToMinutes(value, fallback = "08:00") {
  const candidate = String(value || fallback).trim();
  const match = candidate.match(/^([0-9]{1,2}):([0-9]{2})$/);
  if (!match) {
    return 8 * 60;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function getScheduledMinute(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function supportsConsultationMode(availability, consultationMode) {
  if (!availability) return true;
  switch (String(consultationMode || "IN_PERSON").toUpperCase()) {
    case "CHAT":
      return availability.modes?.chat !== false;
    case "VOICE":
      return availability.modes?.voice === true;
    case "VIDEO":
      return availability.modes?.video === true;
    default:
      return availability.modes?.inPerson !== false;
  }
}

export function isDoctorAvailableAtSlot(availability, scheduledDate, consultationMode) {
  if (!availability) return true;
  if (!supportsConsultationMode(availability, consultationMode)) return false;
  const scheduledMinute = getScheduledMinute(scheduledDate);
  const start = parseTimeToMinutes(availability.startTime, "08:00");
  const end = parseTimeToMinutes(availability.endTime, "17:00");
  return scheduledMinute >= start && scheduledMinute + 1 <= end;
}

export function groupAvailabilityByDoctor(rows) {
  return new Map(rows.map((row) => [String(row.doctor), row]));
}

export function getDoctorAvailabilityRows({ hospitalId, doctorIds, dayOfWeek, consultationMode }, findAvailability) {
  return findAvailability({
    hospital: hospitalId,
    dayOfWeek,
    doctor: { $in: doctorIds },
    isAvailable: true,
    consultationAvailable: true,
  });
}
