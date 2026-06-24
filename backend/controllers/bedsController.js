import Bed from "../models/Bed.js";
import Ward from "../models/Ward.js";
import Encounter from "../models/Encounter.js";
import AuditLog from "../models/AuditLog.js";
import { WORKFLOW } from "../constants/workflowStates.js";
import { audit } from "../utils/audit.js";

function actorHospitalId(req) {
  return req.user?.hospitalId || req.user?.hospital || null;
}

function isGlobalRole(req) {
  return ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(String(req.user?.role || "").toUpperCase());
}

function scopedHospitalId(req) {
  if (isGlobalRole(req)) {
    return req.query?.hospitalId || req.body?.hospitalId || actorHospitalId(req) || null;
  }
  return actorHospitalId(req);
}

function normalizeWardName(value) {
  return String(value || "").trim();
}

async function ensureWard({ hospitalId, name, req, type = "GENERAL", department = "", capacity = 0 }) {
  const wardName = normalizeWardName(name);
  if (!hospitalId || !wardName) return null;
  return Ward.findOneAndUpdate(
    { hospital: hospitalId, name: wardName },
    {
      $setOnInsert: {
        hospital: hospitalId,
        name: wardName,
        code: wardName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24),
        type,
        department,
        capacity,
        active: true,
        createdBy: req?.user?._id || null,
      },
      $set: {
        updatedBy: req?.user?._id || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function listWards(req, res) {
  const hospitalId = scopedHospitalId(req);
  const filter = { active: { $ne: false } };
  if (hospitalId) filter.hospital = hospitalId;
  const wards = await Ward.find(filter)
    .populate("hospital", "name code")
    .sort({ name: 1 })
    .lean();
  return res.json({ items: wards });
}

export async function createWard(req, res) {
  const hospitalId = scopedHospitalId(req);
  if (!hospitalId) return res.status(400).json({ error: "Hospital is required" });
  const ward = await ensureWard({
    hospitalId,
    name: req.body?.name,
    type: String(req.body?.type || "GENERAL").trim().toUpperCase(),
    department: String(req.body?.department || "").trim(),
    capacity: Number(req.body?.capacity || 0) || 0,
    req,
  });
  if (!ward) return res.status(400).json({ error: "Ward name is required" });
  return res.status(201).json({ data: ward });
}

export async function listBeds(req,res){
  const hospitalId = scopedHospitalId(req);
  const filter = {};
  if (hospitalId) filter.hospital = hospitalId;
  const beds = await Bed.find(filter)
    .populate("hospital", "name code")
    .populate("wardRef", "name code type department capacity")
    .populate("patient", "firstName lastName nationalId")
    .lean();
  res.json({ data: beds });
}

export async function updateBed(req,res){
  const { id } = req.params;
  const { occupied, patient } = req.body;
  const hospitalId = scopedHospitalId(req);
  const filter = { _id: id };
  if (hospitalId) filter.hospital = hospitalId;
  const bed = await Bed.findOne(filter);
  if(!bed) return res.status(404).json({error:'Bed not found'});
  const before = bed.toObject();

  if (occupied === false && bed.patient) {
    const openEncounter = await Encounter.findOne({
      hospital: bed.hospital,
      patient: bed.patient,
      state: { $ne: WORKFLOW.CLOSED },
    })
      .select("_id state")
      .lean();
    if (openEncounter) {
      return res.status(409).json({
        error: "Cannot release bed while patient has an open encounter",
        code: "BED_RELEASE_BLOCKED",
      });
    }
  }

  bed.occupied = occupied;
  bed.patient = patient || null;
  await bed.save();
  await audit({
    req,
    action: occupied ? "BED_ASSIGN" : "BED_RELEASE",
    resource: "Bed",
    resourceId: bed._id,
    before,
    after: bed.toObject(),
    metadata: {
      ward: bed.ward,
      number: bed.number,
      patient: bed.patient || null,
    },
  });
  res.json({ data: bed });
}

export async function transferBed(req, res) {
  const { id } = req.params;
  const { targetBedId } = req.body;
  const hospitalId = scopedHospitalId(req);
  if (!targetBedId) return res.status(400).json({ error: "Target bed is required" });

  const baseFilter = {};
  if (hospitalId) baseFilter.hospital = hospitalId;

  const [sourceBed, targetBed] = await Promise.all([
    Bed.findOne({ ...baseFilter, _id: id }),
    Bed.findOne({ ...baseFilter, _id: targetBedId }),
  ]);

  if (!sourceBed || !targetBed) {
    return res.status(404).json({ error: "Bed not found" });
  }
  if (!sourceBed.occupied || !sourceBed.patient) {
    return res.status(400).json({ error: "Source bed has no assigned patient" });
  }
  if (targetBed.occupied) {
    return res.status(409).json({ error: "Target bed is already occupied", code: "BED_TARGET_OCCUPIED" });
  }

  const patientId = sourceBed.patient;
  const before = {
    source: sourceBed.toObject(),
    target: targetBed.toObject(),
  };

  sourceBed.occupied = false;
  sourceBed.patient = null;
  targetBed.occupied = true;
  targetBed.patient = patientId;

  await Promise.all([sourceBed.save(), targetBed.save()]);

  await audit({
    req,
    action: "BED_TRANSFER",
    resource: "Bed",
    resourceId: targetBed._id,
    before,
    after: {
      source: sourceBed.toObject(),
      target: targetBed.toObject(),
    },
    metadata: {
      sourceBedId: String(sourceBed._id),
      targetBedId: String(targetBed._id),
      fromWard: before.source.ward,
      fromNumber: before.source.number,
      toWard: targetBed.ward,
      toNumber: targetBed.number,
      patient: String(patientId),
    },
  });

  return res.json({
    message: "Bed transfer completed",
    data: {
      source: sourceBed,
      target: targetBed,
    },
  });
}

export async function getBedTimeline(req, res) {
  const { id } = req.params;
  const hospitalId = scopedHospitalId(req);
  const filter = { _id: id };
  if (hospitalId) filter.hospital = hospitalId;
  const bed = await Bed.findOne(filter)
    .populate("wardRef", "name code type department capacity")
    .populate("patient", "firstName lastName nationalId")
    .lean();
  if (!bed) return res.status(404).json({ error: "Bed not found" });

  const logs = await AuditLog.find({
    hospital: bed.hospital,
    $or: [
      { resource: "Bed", resourceId: bed._id },
      { "metadata.sourceBedId": String(bed._id) },
      { "metadata.targetBedId": String(bed._id) },
    ],
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(50)
    .populate("actorId", "name email role")
    .lean();

  return res.json({
    data: {
      bed: {
        _id: bed._id,
        ward: bed.ward,
        number: bed.number,
        occupied: bed.occupied,
        patient: bed.patient || null,
      },
      logs,
    },
  });
}

export async function dischargeBed(req, res) {
  const { id } = req.params;
  const { note = "" } = req.body || {};
  const hospitalId = scopedHospitalId(req);
  const filter = { _id: id };
  if (hospitalId) filter.hospital = hospitalId;
  const bed = await Bed.findOne(filter);
  if (!bed) return res.status(404).json({ error: "Bed not found" });
  if (!bed.occupied || !bed.patient) {
    return res.status(400).json({ error: "Bed has no assigned patient" });
  }

  const openEncounter = await Encounter.findOne({
    hospital: bed.hospital,
    patient: bed.patient,
    state: { $ne: WORKFLOW.CLOSED },
  })
    .select("_id state")
    .lean();
  if (openEncounter) {
    return res.status(409).json({
      error: "Cannot discharge bed while patient has an open encounter",
      code: "BED_DISCHARGE_BLOCKED",
    });
  }

  const before = bed.toObject();
  bed.occupied = false;
  bed.patient = null;
  await bed.save();

  await audit({
    req,
    action: "BED_DISCHARGE",
    resource: "Bed",
    resourceId: bed._id,
    before,
    after: bed.toObject(),
    metadata: {
      ward: before.ward,
      number: before.number,
      patient: before.patient,
      note: String(note || "").trim(),
    },
  });

  return res.json({
    message: "Bed discharge completed",
    data: bed,
  });
}

export async function createBed(req,res){
  const { ward, number } = req.body;
  const hospitalId = scopedHospitalId(req);
  if (!hospitalId) return res.status(400).json({ error: "Hospital is required" });
  const wardDoc = await ensureWard({ hospitalId, name: ward, req });
  if (!wardDoc) return res.status(400).json({ error: "Ward is required" });
  const b = await Bed.create({ hospital: hospitalId, ward: wardDoc.name, wardRef: wardDoc._id, number, occupied:false });
  await audit({
    req,
    action: "BED_CREATE",
    resource: "Bed",
    resourceId: b._id,
    after: b.toObject(),
    metadata: { ward: b.ward, number: b.number },
  });
  res.json({ data: b });
}
