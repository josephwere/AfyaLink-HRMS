import express from "express";
import mongoose from "mongoose";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import SupportTicket from "../models/SupportTicket.js";
import SreIncident from "../models/SreIncident.js";
import AuditLog from "../models/AuditLog.js";
import { recordExportEvent } from "../utils/exportAudit.js";

const router = express.Router();

function nextTicketKey() {
  return `sup_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeScope(req, requestedHospital) {
  const role = String(req.user?.effectiveRole || req.user?.role || "").toUpperCase();
  const privileged = ["SUPER_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  return privileged ? requestedHospital || null : req.user?.hospital || null;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

router.use(
  protect,
  requireRole(
    "SUPER_ASSISTANT",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HOSPITAL_ADMIN",
    "HR_MANAGER",
    "SECURITY_ADMIN"
  )
);

router.get("/tickets", async (req, res) => {
  try {
    const hospital = normalizeScope(req, req.query.hospital || null);
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const priority = req.query.priority ? String(req.query.priority).toUpperCase() : null;
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 120, 1), 500);

    const filter = {};
    if (hospital) filter.hospital = hospital;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (q) {
      filter.$or = [
        { ticketKey: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const tickets = await SupportTicket.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate("requester", "name email role")
      .populate("assignee", "name email role")
      .populate("linkedIncident", "incidentKey severity status summary")
      .lean();

    return res.json({ count: tickets.length, tickets });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to list support tickets" });
  }
});

router.get("/tickets/export.csv", async (req, res) => {
  try {
    const hospital = normalizeScope(req, req.query.hospital || null);
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const priority = req.query.priority ? String(req.query.priority).toUpperCase() : null;
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 5000, 1), 10000);

    const filter = {};
    if (hospital) filter.hospital = hospital;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (q) {
      filter.$or = [
        { ticketKey: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const tickets = await SupportTicket.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate("linkedIncident", "incidentKey")
      .lean();

    await recordExportEvent({
      req,
      action: "EXPORT_SUPPORT_TICKETS_CSV",
      resource: "SupportTicket",
      format: "CSV",
      rowCount: tickets.length,
      metadata: {
        status: status || null,
        priority: priority || null,
        hospital: hospital || null,
      },
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="support-tickets-${Date.now()}.csv"`);
    const header = [
      "ticketKey",
      "status",
      "priority",
      "category",
      "title",
      "description",
      "linkedIncident",
      "createdAt",
      "resolvedAt",
    ];
    res.write(`${header.join(",")}\n`);
    for (const row of tickets) {
      const line = [
        row.ticketKey,
        row.status,
        row.priority,
        row.category || "",
        row.title || "",
        row.description || "",
        row.linkedIncident?.incidentKey || "",
        row.createdAt ? new Date(row.createdAt).toISOString() : "",
        row.resolvedAt ? new Date(row.resolvedAt).toISOString() : "",
      ];
      res.write(`${line.map(csvEscape).join(",")}\n`);
    }
    return res.end();
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to export support tickets" });
  }
});

router.post("/tickets", async (req, res) => {
  try {
    const hospital = normalizeScope(req, req.body?.hospital || null);
    const { category, priority, title, description, linkedIncident } = req.body || {};
    if (!title) return res.status(422).json({ message: "title is required" });

    let incidentRef = null;
    if (linkedIncident && mongoose.Types.ObjectId.isValid(String(linkedIncident))) {
      const incident = await SreIncident.findById(linkedIncident).select("_id hospital").lean();
      if (!incident) return res.status(404).json({ message: "Linked incident not found" });
      if (hospital && incident.hospital && String(incident.hospital) !== String(hospital)) {
        return res.status(403).json({ message: "Incident hospital scope mismatch" });
      }
      incidentRef = incident._id;
    }

    const doc = await SupportTicket.create({
      ticketKey: nextTicketKey(),
      hospital,
      category: category ? String(category).toUpperCase() : "OTHER",
      priority: priority ? String(priority).toUpperCase() : "MEDIUM",
      title: String(title).trim(),
      description: String(description || "").trim(),
      requester: req.user._id,
      linkedIncident: incidentRef,
      events: [{ type: "CREATED", actor: req.user._id, note: "Ticket opened" }],
    });

    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "SUPPORT_TICKET_CREATED",
      resource: "support_ticket",
      resourceId: doc._id,
      hospital: doc.hospital || null,
      success: true,
      metadata: {
        ticketKey: doc.ticketKey,
        category: doc.category,
        priority: doc.priority,
        linkedIncident: doc.linkedIncident || null,
      },
    });

    return res.status(201).json({ ok: true, ticket: doc });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to create support ticket" });
  }
});

router.patch("/tickets/:id", async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const hospital = normalizeScope(req, req.query.hospital || null);
    if (hospital && String(ticket.hospital || "") !== String(hospital || "")) {
      return res.status(403).json({ message: "Forbidden hospital scope" });
    }

    const note = String(req.body?.note || "").trim();
    const updates = {};

    if (req.body?.assignee && mongoose.Types.ObjectId.isValid(String(req.body.assignee))) {
      updates.assignee = req.body.assignee;
      updates.status = ticket.status === "OPEN" ? "ASSIGNED" : ticket.status;
      ticket.events.push({ type: "ASSIGNED", actor: req.user._id, note });
    }

    if (req.body?.status) {
      const status = String(req.body.status).toUpperCase();
      if (["OPEN", "ASSIGNED", "ESCALATED", "RESOLVED"].includes(status)) {
        updates.status = status;
        if (status === "ESCALATED") {
          ticket.events.push({ type: "ESCALATED", actor: req.user._id, note });
        }
        if (status === "RESOLVED") {
          updates.resolvedAt = new Date();
          ticket.events.push({ type: "RESOLVED", actor: req.user._id, note });
        }
      }
    }

    if (req.body?.linkedIncident && mongoose.Types.ObjectId.isValid(String(req.body.linkedIncident))) {
      const incident = await SreIncident.findById(req.body.linkedIncident).select("_id hospital").lean();
      if (!incident) return res.status(404).json({ message: "Linked incident not found" });
      if (hospital && incident.hospital && String(incident.hospital) !== String(hospital)) {
        return res.status(403).json({ message: "Incident hospital scope mismatch" });
      }
      updates.linkedIncident = incident._id;
      ticket.events.push({ type: "LINKED_INCIDENT", actor: req.user._id, note });
    }

    if (note && !req.body?.assignee && !req.body?.status && !req.body?.linkedIncident) {
      ticket.events.push({ type: "COMMENT", actor: req.user._id, note });
    }

    Object.assign(ticket, updates);
    await ticket.save();

    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "SUPPORT_TICKET_UPDATED",
      resource: "support_ticket",
      resourceId: ticket._id,
      hospital: ticket.hospital || null,
      success: true,
      metadata: {
        ticketKey: ticket.ticketKey,
        status: ticket.status,
        assignee: ticket.assignee || null,
        linkedIncident: ticket.linkedIncident || null,
      },
    });

    return res.json({ ok: true, ticket });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update ticket" });
  }
});

export default router;
