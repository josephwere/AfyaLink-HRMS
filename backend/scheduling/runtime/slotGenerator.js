/**
 * Slot Generator
 *
 * Generates time slots from a ScheduleTemplate and AppointmentType.
 *
 * Algorithm:
 * 1. For each date in the range
 * 2. Find matching ScheduleTemplate block for that day of week
 * 3. For each template block
 * 4. Calculate slots with duration from AppointmentType
 * 5. Apply preBuffer + postBuffer for gaps
 * 6. Generate deterministic slot ID (idempotent)
 * 7. Check if slot exists; skip if found
 * 8. Create slot with AVAILABLE status
 *
 * Idempotency:
 * - Slot ID = hash(resourceId + scheduledAt + durationMins)
 * - Safe to re-run: existing slots with same ID are skipped
 * - Partial regeneration: can regenerate specific date ranges
 *
 * Batching:
 * - Generate by week to avoid memory spikes
 * - Configurable batch size
 */

import Slot from "../../models/Slot.js";
import ScheduleTemplate from "../../models/ScheduleTemplate.js";
import AppointmentType from "../../models/AppointmentType.js";
import { clockService } from "../../services/clockService.js";
import crypto from "crypto";

export class SlotGenerator {
  /**
   * Generate deterministic slot ID
   * Ensures idempotency: same inputs always produce same ID
   */
  generateSlotId(resourceId, scheduledAt, durationMins) {
    const hash = crypto
      .createHash("sha256")
      .update(`${resourceId}|${scheduledAt.toISOString()}|${durationMins}`)
      .digest("hex")
      .substring(0, 16);

    return `SLOT_${hash}`;
  }

  /**
   * Generate slots for a doctor between date range
   * Integrates ScheduleTemplate, AppointmentType, and exceptions
   */
  async generateSlotsForDateRange(
    resourceId, // Doctor ID
    hospitalId,
    appointmentTypeId,
    startDate,
    endDate,
    options = {}
  ) {
    const {
      resourceType = "DOCTOR",
      timeZone = "UTC",
      batchSize = 100,
      dryRun = false,
      overwrite = false,
    } = options;

    // Validate inputs
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      throw new Error("startDate and endDate must be Date objects");
    }

    if (startDate > endDate) {
      throw new Error("startDate must be before endDate");
    }

    // Fetch appointment type
    const appointmentType = await AppointmentType.findById(appointmentTypeId);
    if (!appointmentType) {
      throw new Error(`AppointmentType not found: ${appointmentTypeId}`);
    }

    // Fetch active schedule templates for this doctor/resource
    // Support both legacy `doctor` field and newer `resource` naming
    const scheduleTemplates = await ScheduleTemplate.find({
      $and: [
        { hospital: hospitalId },
        { active: true },
        {
          $or: [
            { resource: resourceId },
            { doctor: resourceId },
          ],
        },
      ],
    });

    if (!scheduleTemplates.length) {
      return {
        success: true,
        message: "No active schedule templates found",
        slotsGenerated: 0,
        slotsDuplicated: 0,
      };
    }

    let slotsGenerated = 0;
    let slotsDuplicated = 0;

    // Generate slots for each day in range
    let currentDate = new Date(startDate);
    const slots = [];

    while (currentDate <= endDate) {
      const dayOfWeek = clockService.getDayOfWeekInTimezone(currentDate, timeZone);

      // Find template(s) for this day of week
      const dayTemplates = scheduleTemplates.filter((t) =>
        t.daysOfWeek.includes(dayOfWeek)
      );

      if (!dayTemplates.length) {
        // No template for this day; skip
        currentDate = clockService.nextDayInTimezone(currentDate, timeZone);
        continue;
      }

      // Check for exceptions (holidays, leave, maintenance)
      const hasException = await this.hasException(
        resourceId,
        currentDate,
        timeZone
      );
      if (hasException) {
        currentDate = clockService.nextDayInTimezone(currentDate, timeZone);
        continue;
      }

      // Generate slots from all templates for this day
      for (const template of dayTemplates) {
        for (const block of template.blocks) {
          const blockSlots = this.generateSlotsFromBlock(
            resourceId,
            hospitalId,
            currentDate,
            block,
            appointmentType,
            timeZone
          );

          slots.push(...blockSlots);
        }
      }

      currentDate = clockService.nextDayInTimezone(currentDate, timeZone);
    }

    // Batch insert or check for duplicates
    for (let i = 0; i < slots.length; i += batchSize) {
      const batch = slots.slice(i, i + batchSize);

      if (dryRun) {
        // Dry run: just count what would be created
        for (const slot of batch) {
          const existingSlot = await Slot.findOne({ slotId: slot.slotId });
          if (existingSlot) {
            slotsDuplicated++;
          } else {
            slotsGenerated++;
          }
        }
      } else {
        // Real run: upsert slots
        for (const slot of batch) {
          try {
            // Map generated slot to Slot model shape
            const insertDoc = {
              doctor: slot.resourceId,
              hospital: slot.hospital,
              scheduledAt: slot.scheduledAt,
              durationMins: slot.durationMins,
              status: slot.status,
              template: slot.template, // scheduleTemplate._id
              metadata: {
                generatedAt: slot.generatedAt,
                consultationModes: slot.consultationModes,
                preBufferMins: slot.preBufferMins,
                postBufferMins: slot.postBufferMins,
                timezone: slot.timezone,
              },
            };

            const result = await Slot.updateOne(
              { doctor: slot.resourceId, scheduledAt: slot.scheduledAt },
              { $setOnInsert: insertDoc },
              { upsert: true }
            );

            if (result.upsertedId) {
              slotsGenerated++;
            } else {
              slotsDuplicated++;
            }
          } catch (error) {
            console.error(`Error upserting slot ${slot.slotId}:`, error.message);
          }
        }
      }
    }

    return {
      success: true,
      dateRange: { start: startDate, end: endDate },
      slotsGenerated,
      slotsDuplicated,
      totalAttempted: slots.length,
    };
  }

  /**
   * Generate slots from a single template block
   * Accounts for appointment duration and buffers
   */
  generateSlotsFromBlock(
    resourceId,
    hospitalId,
    date,
    block,
    appointmentType,
    timeZone
  ) {
    const slots = [];

    // Parse block times
    const [blockStartHour, blockStartMin] = String(block.startTime || "08:00")
      .split(":")
      .map(Number);
    const [blockEndHour, blockEndMin] = String(block.endTime || "17:00")
      .split(":")
      .map(Number);

    // Create Date objects in specified timezone
    const blockStart = new Date(date);
    blockStart.setHours(blockStartHour, blockStartMin, 0, 0);

    const blockEnd = new Date(date);
    blockEnd.setHours(blockEndHour, blockEndMin, 0, 0);

    // Get appointment duration and buffers
    const slotDurationMins = appointmentType.durationMins;
    const preBuffer = appointmentType.preBufferMins || 0;
    const postBuffer = appointmentType.postBufferMins || 0;
    const totalSlotMins = preBuffer + slotDurationMins + postBuffer;

    // Generate slots
    let currentSlotStart = new Date(blockStart);

    while (currentSlotStart.getTime() + totalSlotMins * 60000 <= blockEnd.getTime()) {
      const slotEnd = new Date(
        currentSlotStart.getTime() + totalSlotMins * 60000
      );

      const slotId = this.generateSlotId(resourceId, currentSlotStart, slotDurationMins);

      // Normalize consultation modes: support block.modes (object) and appointmentType arrays
      let consultationModes = [];
      if (Array.isArray(block.modes) && block.modes.length) {
        consultationModes = block.modes;
      } else if (block.modes && typeof block.modes === "object") {
        const map = { inPerson: "IN_PERSON", voice: "VOICE", video: "VIDEO", chat: "CHAT" };
        consultationModes = Object.keys(block.modes)
          .filter((k) => block.modes[k])
          .map((k) => map[k] || k.toUpperCase());
      } else {
        consultationModes = appointmentType.supportedModes || [];
      }

      slots.push({
        slotId,
        resourceId,
        resourceType: "DOCTOR", // Later: abstract this
        hospital: hospitalId,
        scheduledAt: currentSlotStart,
        endTime: slotEnd,
        durationMins: slotDurationMins,
        preBufferMins: preBuffer,
        postBufferMins: postBuffer,
        status: "AVAILABLE",
        consultationModes,
        maxAppointments: block.maxAppointments || 1,
        appointmentType: appointmentType._id,
        template: block._id,
        generatedAt: clockService.nowUTC(),
        timezone: timeZone,
      });

      // Move to next slot, respecting buffer
      currentSlotStart = new Date(
        currentSlotStart.getTime() + totalSlotMins * 60000
      );
    }

    return slots;
  }

  /**
   * Check if date has an exception (holiday, leave, maintenance, etc.)
   */
  async hasException(resourceId, date, timeZone) {
    // TODO: Query DoctorLeave, HospitalHoliday, MaintenanceWindow models
    // For now, just return false (no exceptions)
    return false;
  }

  /**
   * Bulk regenerate slots for a date range
   * Useful for schedule updates or catchup
   */
  async regenerateSlotsForRange(resourceId, hospitalId, startDate, endDate) {
    // Get all appointment types
    const appointmentTypes = await AppointmentType.find({
      hospital: hospitalId,
      active: true,
    });

    const results = [];

    for (const appointmentType of appointmentTypes) {
      const result = await this.generateSlotsForDateRange(
        resourceId,
        hospitalId,
        appointmentType._id,
        startDate,
        endDate
      );
      results.push({
        appointmentType: appointmentType.name,
        ...result,
      });
    }

    return {
      regenerated: true,
      dateRange: { start: startDate, end: endDate },
      appointmentTypeResults: results,
    };
  }

  /**
   * Verify slot generation for a specific date
   * Returns what slots WOULD be generated (dry run)
   */
  async previewSlotsForDate(resourceId, hospitalId, appointmentTypeId, date) {
    const dateStart = clockService.startOfDayInTimezone(date, "UTC");
    const dateEnd = clockService.endOfDayInTimezone(date, "UTC");

    const result = await this.generateSlotsForDateRange(
      resourceId,
      hospitalId,
      appointmentTypeId,
      dateStart,
      dateEnd,
      { dryRun: true }
    );

    return result;
  }

  /**
   * Delete slots for a date range
   * Useful for schedule corrections or cancellations
   */
  async deleteSlotsForRange(resourceId, startDate, endDate) {
    const result = await Slot.deleteMany({
      resourceId,
      scheduledAt: { $gte: startDate, $lte: endDate },
      status: "AVAILABLE", // Only delete available slots
    });

    return {
      deleted: result.deletedCount,
      message: `Deleted ${result.deletedCount} available slots between ${startDate} and ${endDate}`,
    };
  }

  /**
   * Get available slots for a doctor on a date
   */
  async getAvailableSlots(resourceId, date, consultationMode = null) {
    const dayStart = clockService.startOfDayInTimezone(date, "UTC");
    const dayEnd = clockService.endOfDayInTimezone(date, "UTC");

    const query = {
      doctor: resourceId,
      status: "AVAILABLE",
      scheduledAt: { $gte: dayStart, $lte: dayEnd },
    };

    if (consultationMode) {
      query["metadata.consultationModes"] = consultationMode;
    }

    const slots = await Slot.find(query)
      .select("scheduledAt endTime durationMins status metadata preBufferMins postBufferMins")
      .sort({ scheduledAt: 1 })
      .lean();

    // Normalize output to include `consultationModes` for callers
    return slots.map((s) => ({
      ...s,
      consultationModes: (s.metadata && s.metadata.consultationModes) || [],
    }));
  }

  /**
   * Get availability summary for a doctor
   */
  async getAvailabilitySummary(resourceId, startDate, endDate) {
    const slots = await Slot.aggregate([
      {
        $match: {
          resourceId,
          scheduledAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          firstSlot: { $min: "$scheduledAt" },
          lastSlot: { $max: "$scheduledAt" },
        },
      },
    ]);

    return {
      summary: slots,
      dateRange: { start: startDate, end: endDate },
    };
  }
}

// Export singleton
export const slotGenerator = new SlotGenerator();
