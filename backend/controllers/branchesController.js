import Branch from "../models/Branch.js";

const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);

function actorRole(req) {
  return String(req.user?.actualRole || req.user?.role || "").toUpperCase();
}

function isPrivileged(req) {
  return PRIVILEGED_ROLES.has(actorRole(req));
}

function resolveHospitalId(req, { allowQuery = true, allowBody = true, required = true } = {}) {
  const fromQuery = allowQuery ? req.query?.hospitalId : null;
  const fromBody = allowBody ? req.body?.hospitalId : null;
  const fromUser = req.user?.hospital || req.user?.hospitalId || null;

  const hospital = isPrivileged(req)
    ? fromQuery || fromBody || fromUser
    : fromUser;

  if (required && !hospital) return null;
  return hospital || null;
}

export const index = async (_req, res) => {
  res.json({ module: "branches", status: "ok" });
};

export const list = async (req, res) => {
  try {
    const hospital = resolveHospitalId(req, { allowQuery: true, allowBody: false, required: false });
    if (!hospital && !isPrivileged(req)) {
      return res.status(400).json({ error: "Hospital context is required" });
    }

    const filter = { active: true };
    if (hospital) filter.hospital = hospital;

    const items = await Branch.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ data: items });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load branches" });
  }
};

export const create = async (req, res) => {
  try {
    const hospital = resolveHospitalId(req, { allowQuery: false, allowBody: true, required: true });
    const { name, location } = req.body || {};
    if (!hospital) {
      return res.status(400).json({ error: "hospitalId is required" });
    }
    if (!name || !location) {
      return res.status(400).json({ error: "name and location are required" });
    }
    const branch = await Branch.create({
      hospital,
      name: String(name).trim(),
      location: String(location).trim(),
      createdBy: req.user?._id,
    });
    res.status(201).json({ data: branch });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create branch" });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, active } = req.body || {};
    const branch = await Branch.findById(id);
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    const userHospital = req.user?.hospital || req.user?.hospitalId || null;
    if (!isPrivileged(req) && String(branch.hospital) !== String(userHospital)) {
      return res.status(403).json({ error: "Cross-hospital access denied" });
    }

    if (name !== undefined) branch.name = String(name).trim();
    if (location !== undefined) branch.location = String(location).trim();
    if (active !== undefined) branch.active = Boolean(active);

    await branch.save();
    res.json({ data: branch });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update branch" });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findById(id);
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    const userHospital = req.user?.hospital || req.user?.hospitalId || null;
    if (!isPrivileged(req) && String(branch.hospital) !== String(userHospital)) {
      return res.status(403).json({ error: "Cross-hospital access denied" });
    }
    branch.active = false;
    await branch.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to remove branch" });
  }
};
