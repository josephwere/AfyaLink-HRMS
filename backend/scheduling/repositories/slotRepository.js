import Slot from "../../models/Slot.js";

export async function findSlotByDoctorAt(doctorId, scheduledAt) {
  return Slot.findOne({
    doctor: doctorId,
    scheduledAt,
    status: { $in: ["AVAILABLE", "HELD", "BOOKED"] },
  }).lean();
}

export async function createSlot(slotData) {
  const slot = new Slot(slotData);
  return slot.save();
}

export async function updateSlotStatus(slotId, status) {
  return Slot.findByIdAndUpdate(slotId, { status }, { new: true }).lean();
}
