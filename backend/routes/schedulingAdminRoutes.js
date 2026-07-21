/**
 * Admin Scheduling API
 *
 * Routes for managing ScheduleTemplate, generating slots, and querying availability.
 *
 * Endpoints:
 * POST   /scheduling/templates - Create template
 * GET    /scheduling/templates/:id - Get template
 * PUT    /scheduling/templates/:id - Update template
 * DELETE /scheduling/templates/:id - Deactivate template
 * GET    /scheduling/templates - List templates for hospital
 *
 * POST   /scheduling/slots/generate - Generate slots for date range
 * GET    /scheduling/doctors/:doctorId/slots - Get available slots
 * GET    /scheduling/doctors/:doctorId/availability - Get availability summary
 *
 * POST   /scheduling/templates/:id/exceptions - Add leave/holiday
 * DELETE /scheduling/templates/:id/exceptions/:exceptionId - Remove exception
 */

import express from "express";
import ScheduleTemplate from "../../models/ScheduleTemplate.js";
import AppointmentType from "../../models/AppointmentType.js";
import User from "../../models/User.js";
import { slotGenerator } from "../../scheduling/runtime/slotGenerator.js";
import { clockService } from "../../services/clockService.js";

const router = express.Router();

// Middleware: Check admin or HR role
const requireSchedulingAdmin = (req, res, next) => {
  if (!req.user || !["ADMIN", "HR"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Insufficient permissions for scheduling administration",
    });
  }
  next();
};

/* ========== SCHEDULE TEMPLATE ENDPOINTS ========== */

/**
 * Create a new schedule template
 * POST /scheduling/templates
 */
router.post("/templates", requireSchedulingAdmin, async (req, res) => {
  try {
    const {
      name,
      resourceId, // Doctor ID
      resourceType = "DOCTOR",
      hospitalId,
      daysOfWeek,
      blocks,
      active = true,
      description,
    } = req.body;

    // Validate required fields
    if (!resourceId || !hospitalId || !daysOfWeek || !blocks) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: resourceId, hospitalId, daysOfWeek, blocks",
      });
    }

    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "daysOfWeek must be non-empty array" });
    }

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "blocks must be non-empty array" });
    }

    // Verify doctor exists
    const doctor = await User.findById(resourceId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    // Create template
    const template = new ScheduleTemplate({
      name: name || `${doctor.name} Schedule`,
      resource: resourceId,
      resourceType,
      hospital: hospitalId,
      daysOfWeek,
      blocks,
      active,
      description,
      createdBy: req.user._id,
    });

    await template.save();

    res.json({
      success: true,
      message: "Schedule template created",
      template,
    });
  } catch (error) {
    console.error("[AdminSchedulingAPI] Error creating template:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get schedule template by ID
 * GET /scheduling/templates/:id
 */
router.get("/templates/:id", requireSchedulingAdmin, async (req, res) => {
  try {
    const template = await ScheduleTemplate.findById(req.params.id)
      .populate("resource", "_id name email")
      .populate("hospital", "_id name");

    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Update schedule template
 * PUT /scheduling/templates/:id
 */
router.put("/templates/:id", requireSchedulingAdmin, async (req, res) => {
  try {
    const { name, daysOfWeek, blocks, active, description } = req.body;

    const template = await ScheduleTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    // Update allowed fields
    if (name !== undefined) template.name = name;
    if (daysOfWeek !== undefined) template.daysOfWeek = daysOfWeek;
    if (blocks !== undefined) template.blocks = blocks;
    if (active !== undefined) template.active = active;
    if (description !== undefined) template.description = description;

    template.updatedBy = req.user._id;
    template.updatedAt = clockService.nowUTC();

    await template.save();

    res.json({
      success: true,
      message: "Schedule template updated",
      template,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Deactivate schedule template
 * DELETE /scheduling/templates/:id
 */
router.delete("/templates/:id", requireSchedulingAdmin, async (req, res) => {
  try {
    const template = await ScheduleTemplate.findByIdAndUpdate(
      req.params.id,
      { active: false, updatedBy: req.user._id, updatedAt: clockService.nowUTC() },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    res.json({
      success: true,
      message: "Schedule template deactivated",
      template,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * List templates for hospital
 * GET /scheduling/templates?hospitalId=...&resourceId=...
 */
router.get("/templates", requireSchedulingAdmin, async (req, res) => {
  try {
    const { hospitalId, resourceId, active = true } = req.query;

    const query = {};
    if (hospitalId) query.hospital = hospitalId;
    if (resourceId) query.resource = resourceId;
    if (active !== "false") query.active = true;

    const templates = await ScheduleTemplate.find(query)
      .populate("resource", "_id name email")
      .populate("hospital", "_id name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: templates.length,
      templates,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ========== SLOT GENERATION ENDPOINTS ========== */

/**
 * Generate slots for a doctor
 * POST /scheduling/slots/generate
 */
router.post("/slots/generate", requireSchedulingAdmin, async (req, res) => {
  try {
    const {
      doctorId,
      hospitalId,
      appointmentTypeId,
      startDate,
      endDate,
      dryRun = false,
      overwrite = false,
    } = req.body;

    if (!doctorId || !hospitalId || !appointmentTypeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: doctorId, hospitalId, appointmentTypeId, startDate, endDate",
      });
    }

    // Verify appointment type exists
    const appointmentType = await AppointmentType.findById(appointmentTypeId);
    if (!appointmentType) {
      return res
        .status(404)
        .json({ success: false, message: "AppointmentType not found" });
    }

    const result = await slotGenerator.generateSlotsForDateRange(
      doctorId,
      hospitalId,
      appointmentTypeId,
      new Date(startDate),
      new Date(endDate),
      { dryRun, overwrite }
    );

    res.json({
      success: true,
      message: dryRun
        ? "Slot generation preview (dry run)"
        : "Slots generated successfully",
      ...result,
    });
  } catch (error) {
    console.error("[AdminSchedulingAPI] Error generating slots:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get available slots for a doctor
 * GET /scheduling/doctors/:doctorId/slots?date=2024-01-15&mode=IN_PERSON
 */
router.get("/doctors/:doctorId/slots", requireSchedulingAdmin, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, mode } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date query parameter required (format: YYYY-MM-DD)",
      });
    }

    const queryDate = new Date(date);
    const slots = await slotGenerator.getAvailableSlots(doctorId, queryDate, mode);

    res.json({
      success: true,
      date: date,
      mode: mode || "any",
      count: slots.length,
      slots,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get availability summary for a doctor
 * GET /scheduling/doctors/:doctorId/availability?startDate=...&endDate=...
 */
router.get("/doctors/:doctorId/availability", requireSchedulingAdmin, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate query parameters required",
      });
    }

    const summary = await slotGenerator.getAvailabilitySummary(
      doctorId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Delete slots for a date range (recovery/correction)
 * DELETE /scheduling/slots?doctorId=...&startDate=...&endDate=...
 */
router.delete("/slots", requireSchedulingAdmin, async (req, res) => {
  try {
    const { doctorId, startDate, endDate } = req.query;

    if (!doctorId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "doctorId, startDate, endDate query parameters required",
      });
    }

    const result = await slotGenerator.deleteSlotsForRange(
      doctorId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ========== EXCEPTION MANAGEMENT ========== */

/**
 * Add exception (leave, holiday) to template
 * POST /scheduling/templates/:id/exceptions
 */
router.post(
  "/templates/:id/exceptions",
  requireSchedulingAdmin,
  async (req, res) => {
    try {
      const { exceptionType, startDate, endDate, reason } = req.body;

      if (!exceptionType || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: exceptionType, startDate, endDate",
        });
      }

      const template = await ScheduleTemplate.findById(req.params.id);
      if (!template) {
        return res.status(404).json({ success: false, message: "Template not found" });
      }

      template.exceptions = template.exceptions || [];
      template.exceptions.push({
        type: exceptionType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        createdBy: req.user._id,
      });

      await template.save();

      res.json({
        success: true,
        message: "Exception added",
        template,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

export default router;
