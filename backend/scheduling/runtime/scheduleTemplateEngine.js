import ScheduleTemplate from "../../models/ScheduleTemplate.js";

export async function loadActiveTemplates(hospitalId) {
  return ScheduleTemplate.find({ hospital: hospitalId, active: true }).lean();
}

export function findTemplateForDay(templateRows = [], dayOfWeek, doctorId = null) {
  const doctorTemplates = doctorId
    ? templateRows.filter((row) => String(row.doctor || "") === String(doctorId))
    : [];
  const candidates = doctorTemplates.length ? doctorTemplates : templateRows;
  return candidates.find((row) => Array.isArray(row.daysOfWeek) && row.daysOfWeek.includes(dayOfWeek)) || null;
}

export function parseTimeToMinutes(value, fallback = "00:00") {
  const [hours, minutes] = String(value || fallback).split(":").map(Number);
  return Number.isNaN(hours) || Number.isNaN(minutes) ? 0 : hours * 60 + minutes;
}

export function isModeAllowed(block, consultationMode = "IN_PERSON") {
  if (!block || typeof block !== "object") return false;
  switch (String(consultationMode || "IN_PERSON").toUpperCase()) {
    case "CHAT":
      return block.modes?.chat !== false;
    case "VOICE":
      return block.modes?.voice === true;
    case "VIDEO":
      return block.modes?.video === true;
    default:
      return block.modes?.inPerson !== false;
  }
}

export function findTemplateBlock(template, scheduledDate, durationMins, consultationMode = "IN_PERSON") {
  if (!template || !Array.isArray(template.blocks)) return null;
  const scheduledMinute = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
  return template.blocks.find((block) => {
    const start = parseTimeToMinutes(block.startTime, "00:00");
    const end = parseTimeToMinutes(block.endTime, "23:59");
    return (
      scheduledMinute >= start &&
      scheduledMinute + Number(durationMins || 0) <= end &&
      isModeAllowed(block, consultationMode)
    );
  }) || null;
}

export function validateTemplateBlock(block) {
  if (!block || typeof block !== "object") return false;
  const { startTime, endTime, durationMins, bufferMins } = block;
  return (
    typeof startTime === "string" && typeof endTime === "string" &&
    Number.isInteger(durationMins) && durationMins > 0 &&
    Number.isInteger(bufferMins) && bufferMins >= 0
  );
}

export function applyTemplateToDoctor(template, doctorId) {
  if (!template || !doctorId) return null;
  return {
    ...template,
    doctor: doctorId,
  };
}
