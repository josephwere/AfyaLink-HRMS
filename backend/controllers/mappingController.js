import Hl7Mapping from "../models/Hl7Mapping.js";
import { signProvenance, verifyProvenance } from "../utils/provenance.js";
import { logAudit } from "../services/auditService.js";

function getByPath(obj, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function setByPath(obj, path, value) {
  const keys = String(path).split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!cur[key] || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  }
  cur[keys[keys.length - 1]] = value;
}

function parseHl7ToMap(text = "") {
  const out = {};
  const lines = String(text).split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const fields = line.split("|");
    const seg = fields[0];
    for (let i = 1; i < fields.length; i += 1) {
      out[`${seg}-${i}`] = fields[i];
    }
  }
  return out;
}

function applyMappingToPayload(mappingDef = {}, source = {}) {
  const transformed = {};
  for (const [sourceKey, targetPath] of Object.entries(mappingDef || {})) {
    const value = source[sourceKey] ?? getByPath(source, sourceKey);
    if (value !== undefined) setByPath(transformed, targetPath, value);
  }
  return transformed;
}

/* ======================================================
   ➕ CREATE HL7 MAPPING
====================================================== */
export const createHl7Mapping = async (req, res) => {
  try {
    const mapping = await Hl7Mapping.create(req.body);
    res.status(201).json(mapping);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* ======================================================
   📋 LIST ALL HL7 MAPPINGS
====================================================== */
export const getHl7Mappings = async (req, res) => {
  try {
    const mappings = await Hl7Mapping.find();
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   🔍 GET SINGLE HL7 MAPPING
====================================================== */
export const getHl7MappingById = async (req, res) => {
  try {
    const mapping = await Hl7Mapping.findById(req.params.id);
    if (!mapping) {
      return res.status(404).json({ message: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   ✏️ UPDATE HL7 MAPPING
====================================================== */
export const updateHl7Mapping = async (req, res) => {
  try {
    const mapping = await Hl7Mapping.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(mapping);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* ======================================================
   🗑 DELETE HL7 MAPPING
====================================================== */
export const deleteHl7Mapping = async (req, res) => {
  try {
    await Hl7Mapping.findByIdAndDelete(req.params.id);
    res.json({ message: "Mapping deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const listMappingTemplates = async (_req, res) => {
  try {
    const templates = [
      {
        id: "hl7-orm-to-order",
        title: "HL7 ORM to AfyaLink Lab Order",
        format: "HL7",
        mapping: {
          "PID-5": "patient.name",
          "PID-7": "patient.dateOfBirth",
          "OBR-4": "order.testCode",
          "OBR-16": "order.requestingProvider",
        },
      },
      {
        id: "fhir-patient-to-profile",
        title: "FHIR Patient to AfyaLink Patient Profile",
        format: "FHIR",
        mapping: {
          "name.0.text": "patient.name",
          "gender": "patient.gender",
          "birthDate": "patient.dateOfBirth",
          "id": "patient.externalId",
        },
      },
    ];
    return res.json({ templates });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const previewMappingTransform = async (req, res) => {
  try {
    const { mappingId, mapping, format = "FHIR", payload } = req.body || {};
    let mappingDoc = null;
    if (mappingId) {
      mappingDoc = await Hl7Mapping.findById(mappingId).lean();
      if (!mappingDoc) return res.status(404).json({ message: "Mapping not found" });
    }
    const mappingDef = mapping || mappingDoc?.mapping;
    if (!mappingDef || typeof mappingDef !== "object") {
      return res.status(400).json({ message: "Mapping definition is required" });
    }
    if (payload === undefined || payload === null) {
      return res.status(400).json({ message: "payload is required" });
    }

    const source =
      String(format).toUpperCase() === "HL7" ? parseHl7ToMap(String(payload)) : payload;
    const transformed = applyMappingToPayload(mappingDef, source);
    const provenance = signProvenance(
      {
        format: String(format).toUpperCase(),
        source,
        transformed,
        mappingId: mappingDoc?._id || null,
      },
      { feature: "mapping_preview" }
    );

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "MAPPING_PREVIEW_EXECUTED",
      resource: "mapping",
      resourceId: mappingDoc?._id || null,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: { format: String(format).toUpperCase(), mappingId: mappingDoc?._id || null },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json({
      ok: true,
      format: String(format).toUpperCase(),
      mappingId: mappingDoc?._id || null,
      transformed,
      provenance,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const signMappingPayload = async (req, res) => {
  try {
    const { payload, context = {} } = req.body || {};
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ message: "payload object is required" });
    }
    const signature = signProvenance(payload, context);
    return res.json({ ok: true, signature });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const verifyMappingPayload = async (req, res) => {
  try {
    const { payload, signature } = req.body || {};
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ message: "payload object is required" });
    }
    const sig = typeof signature === "string" ? signature : signature?.signature;
    const out = verifyProvenance(payload, sig);
    return res.json({ ok: true, verification: out });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
