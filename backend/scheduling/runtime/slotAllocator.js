export function toMinutes(t) {
  return Math.floor(t / 60000);
}

export function parseTimeString(value) {
  const [hours, minutes] = String(value || "00:00").split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function formatTimeSlot(startDate, durationMins) {
  const endDate = new Date(startDate.getTime() + durationMins * 60000);
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}

export function buildSlots({ startTime, endTime, durationMins, bufferMins = 0, day, timeZone = "UTC" }) {
  const slots = [];
  const current = new Date(day);
  current.setUTCHours(0, 0, 0, 0);

  const [startHour, startMinute] = String(startTime).split(":").map(Number);
  const [endHour, endMinute] = String(endTime).split(":").map(Number);

  const slotStart = new Date(current);
  slotStart.setUTCHours(startHour, startMinute, 0, 0);
  const slotEnd = new Date(current);
  slotEnd.setUTCHours(endHour, endMinute, 0, 0);

  while (slotStart.getTime() + durationMins * 60000 <= slotEnd.getTime()) {
    const slot = {
      start: new Date(slotStart),
      end: new Date(slotStart.getTime() + durationMins * 60000),
    };
    slots.push(slot);
    slotStart.setTime(slotStart.getTime() + (durationMins + bufferMins) * 60000);
  }

  return slots;
}

export function filterAvailableSlots({ slots, bookedRanges = [] }) {
  return slots.filter((slot) => {
    return !bookedRanges.some((booked) => {
      return (
        slot.start < new Date(booked.end) && slot.end > new Date(booked.start)
      );
    });
  });
}

export function normalizeDateInput(value) {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
