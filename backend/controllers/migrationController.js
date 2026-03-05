import axios from "axios";
import HospitalMigrationProject from "../models/HospitalMigrationProject.js";
import Connector from "../models/Connector.js";
import { logAudit } from "../services/auditService.js";

const PRIVILEGED = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);
const ALLOWED_STATUSES = new Set([
  "DRAFT",
  "CONNECTING",
  "MAPPING",
  "DRY_RUN",
  "PARALLEL_RUN",
  "CUTOVER_READY",
  "CUTOVER_DONE",
  "ROLLBACK",
  "PAUSED",
]);
const STATUS_TO_RUNTIME = {
  DRY_RUN: { mode: "SHADOW", dryRun: true },
  PARALLEL_RUN: { mode: "MIRROR", dryRun: false },
  CUTOVER_READY: { mode: "MIRROR", dryRun: false },
  CUTOVER_DONE: { mode: "CUTOVER", dryRun: false },
  ROLLBACK: { mode: "ROLLBACK", dryRun: true },
  PAUSED: { mode: "PAUSED", dryRun: true },
};

function isPrivileged(role) {
  return PRIVILEGED.has(String(role || "").toUpperCase());
}

function getActorHospital(req) {
  return req.user?.hospitalId || req.user?.hospital || null;
}

function buildFilter(req) {
  const role = String(req.user?.actualRole || req.user?.role || "").toUpperCase();
  const hospitalId = req.query.hospitalId || getActorHospital(req);
  if (isPrivileged(role)) {
    return hospitalId ? { hospital: hospitalId } : {};
  }
  return { hospital: hospitalId };
}

async function writeAudit(req, action, resourceId, after = null) {
  await logAudit({
    actorId: req.user._id,
    actorRole: req.user.actualRole || req.user.role,
    action,
    resource: "HospitalMigrationProject",
    resourceId,
    hospital: getActorHospital(req),
    ip: req.ip,
    userAgent: req.get("user-agent"),
    after,
  });
}

async function syncConnectorRuntime(project, status) {
  const connectorId = project?.sourceSystem?.connectorId;
  const runtimeTarget = STATUS_TO_RUNTIME[String(status || "").toUpperCase()];
  if (!connectorId || !runtimeTarget) return null;
  const connector = await Connector.findById(connectorId);
  if (!connector) return null;
  connector.runtime = {
    ...(connector.runtime || {}),
    mode: runtimeTarget.mode,
    dryRun: runtimeTarget.dryRun,
    migrationProjectId: project._id,
  };
  await connector.save();
  return connector;
}

export const createMigrationProject = async (req, res, next) => {
  try {
    const actorRole = String(req.user?.actualRole || req.user?.role || "").toUpperCase();
    const actorHospital = getActorHospital(req);
    const body = req.body || {};
    const targetHospital =
      isPrivileged(actorRole) && body.hospitalId ? body.hospitalId : actorHospital;

    if (!targetHospital) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (!body.name) {
      return res.status(400).json({ message: "Project name is required" });
    }

    const project = await HospitalMigrationProject.create({
      hospital: targetHospital,
      name: String(body.name).trim(),
      sourceSystem: {
        name: body.sourceSystem?.name || "",
        vendor: body.sourceSystem?.vendor || "",
        type: body.sourceSystem?.type || "OTHER",
        connectorId: body.sourceSystem?.connectorId || undefined,
        interoperability: Array.isArray(body.sourceSystem?.interoperability)
          ? body.sourceSystem.interoperability
          : [],
      },
      strategy: {
        mode: body.strategy?.mode || "HYBRID",
        aiEngine: body.strategy?.aiEngine || "NEUROEDGE",
        dualWrite: body.strategy?.dualWrite !== false,
        cutoverWindow: {
          startAt: body.strategy?.cutoverWindow?.startAt || undefined,
          endAt: body.strategy?.cutoverWindow?.endAt || undefined,
        },
      },
      status: "DRAFT",
      notes: body.notes || "",
      risks: Array.isArray(body.risks) ? body.risks : [],
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await writeAudit(req, "MIGRATION_PROJECT_CREATED", project._id, {
      status: project.status,
      sourceType: project.sourceSystem?.type,
      strategy: project.strategy?.mode,
    });

    return res.status(201).json({ success: true, project });
  } catch (err) {
    return next(err);
  }
};

export const listMigrationProjects = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim().toUpperCase();
    const filter = buildFilter(req);

    if (status && ALLOWED_STATUSES.has(status)) filter.status = status;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { "sourceSystem.name": { $regex: q, $options: "i" } },
        { "sourceSystem.vendor": { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      HospitalMigrationProject.find(filter)
        .populate("hospital", "name code")
        .populate("sourceSystem.connectorId", "name type status")
        .populate("createdBy", "name email role")
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      HospitalMigrationProject.countDocuments(filter),
    ]);

    return res.json({ success: true, items, total, page, limit });
  } catch (err) {
    return next(err);
  }
};

export const getMigrationProject = async (req, res, next) => {
  try {
    const filter = { ...buildFilter(req), _id: req.params.id };
    const project = await HospitalMigrationProject.findOne(filter)
      .populate("hospital", "name code")
      .populate("sourceSystem.connectorId", "name type status url")
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role");

    if (!project) return res.status(404).json({ message: "Migration project not found" });
    return res.json({ success: true, project });
  } catch (err) {
    return next(err);
  }
};

export const updateMigrationProject = async (req, res, next) => {
  try {
    const filter = { ...buildFilter(req), _id: req.params.id };
    const project = await HospitalMigrationProject.findOne(filter);
    if (!project) return res.status(404).json({ message: "Migration project not found" });

    const body = req.body || {};
    if (body.name !== undefined) project.name = String(body.name || "").trim();
    if (body.notes !== undefined) project.notes = String(body.notes || "");
    if (Array.isArray(body.risks)) project.risks = body.risks.map((r) => String(r || "").trim()).filter(Boolean);

    if (body.sourceSystem && typeof body.sourceSystem === "object") {
      project.sourceSystem = {
        ...project.sourceSystem,
        ...body.sourceSystem,
      };
    }
    if (body.strategy && typeof body.strategy === "object") {
      project.strategy = {
        ...project.strategy,
        ...body.strategy,
      };
    }
    if (body.progress && typeof body.progress === "object") {
      project.progress = {
        ...project.progress,
        ...body.progress,
      };
    }
    if (body.status) {
      const nextStatus = String(body.status).toUpperCase();
      if (!ALLOWED_STATUSES.has(nextStatus)) {
        return res.status(400).json({ message: "Invalid migration status" });
      }
      project.status = nextStatus;
    }

    project.updatedBy = req.user._id;
    await project.save();
    await writeAudit(req, "MIGRATION_PROJECT_UPDATED", project._id, {
      status: project.status,
    });
    return res.json({ success: true, project });
  } catch (err) {
    return next(err);
  }
};

export const testMigrationConnector = async (req, res, next) => {
  try {
    const filter = { ...buildFilter(req), _id: req.params.id };
    const project = await HospitalMigrationProject.findOne(filter);
    if (!project) return res.status(404).json({ message: "Migration project not found" });

    const connectorId = req.body?.connectorId || project.sourceSystem?.connectorId;
    if (!connectorId) {
      return res.status(400).json({ message: "Connector is required for connectivity test" });
    }

    const connector = await Connector.findById(connectorId).lean();
    if (!connector) return res.status(404).json({ message: "Connector not found" });

    let health = { ok: false, status: null };
    try {
      const response = await axios.get(`${String(connector.url || "").replace(/\/$/, "")}/health`, {
        timeout: 8000,
      });
      health = { ok: true, status: response.status, data: response.data };
    } catch (err) {
      health = { ok: false, status: err?.response?.status || null, error: err?.message || "Connectivity test failed" };
    }

    project.sourceSystem.connectorId = connector._id;
    project.status = health.ok ? "CONNECTING" : project.status;
    project.updatedBy = req.user._id;
    project.progress = {
      ...project.progress,
      lastRunAt: new Date(),
    };
    await project.save();

    await writeAudit(req, "MIGRATION_CONNECTOR_TESTED", project._id, {
      connectorId: String(connector._id),
      ok: health.ok,
      status: health.status,
    });

    return res.json({
      success: true,
      connector: {
        id: connector._id,
        name: connector.name,
        type: connector.type,
        url: connector.url,
      },
      health,
      project,
    });
  } catch (err) {
    return next(err);
  }
};

export const startMigrationDryRun = async (req, res, next) => {
  try {
    const filter = { ...buildFilter(req), _id: req.params.id };
    const project = await HospitalMigrationProject.findOne(filter);
    if (!project) return res.status(404).json({ message: "Migration project not found" });

    project.status = "DRY_RUN";
    project.updatedBy = req.user._id;
    project.progress = {
      ...project.progress,
      lastRunAt: new Date(),
    };
    await project.save();
    await syncConnectorRuntime(project, "DRY_RUN");

    await writeAudit(req, "MIGRATION_DRY_RUN_STARTED", project._id, {
      strategy: project.strategy?.mode,
      aiEngine: project.strategy?.aiEngine || "NEUROEDGE",
    });

    return res.json({
      success: true,
      message:
        "Dry run started. Validate mappings, data quality and consent-safe extraction before cutover.",
      project,
    });
  } catch (err) {
    return next(err);
  }
};

export const transitionMigrationProject = async (req, res, next) => {
  try {
    const filter = { ...buildFilter(req), _id: req.params.id };
    const project = await HospitalMigrationProject.findOne(filter);
    if (!project) return res.status(404).json({ message: "Migration project not found" });

    const nextStatus = String(req.body?.status || "").toUpperCase();
    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return res.status(400).json({ message: "Invalid migration status" });
    }

    project.status = nextStatus;
    project.updatedBy = req.user._id;
    project.progress = {
      ...project.progress,
      lastRunAt: new Date(),
    };
    await project.save();
    const connector = await syncConnectorRuntime(project, nextStatus);

    await writeAudit(req, "MIGRATION_STATUS_TRANSITIONED", project._id, {
      status: nextStatus,
      connectorId: project.sourceSystem?.connectorId || null,
      connectorRuntimeMode: connector?.runtime?.mode || null,
      connectorDryRun: connector?.runtime?.dryRun ?? null,
    });

    return res.json({
      success: true,
      project,
      connectorRuntime: connector
        ? {
            connectorId: connector._id,
            mode: connector.runtime?.mode,
            dryRun: connector.runtime?.dryRun,
          }
        : null,
    });
  } catch (err) {
    return next(err);
  }
};
