import Branch from "../models/Branch.js";
import Hospital from "../models/Hospital.js";
import GovernmentHospitalRegistry from "../models/GovernmentHospitalRegistry.js";
import Notification from "../models/Notification.js";

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
    const { name, location, email, phone, registrationNumber, branchLicenseRequired } = req.body || {};
    if (!hospital) {
      return res.status(400).json({ error: "hospitalId is required" });
    }
    if (!name || !location) {
      return res.status(400).json({ error: "name and location are required" });
    }
    const parentHospital = await Hospital.findById(hospital).lean();
    if (!parentHospital) {
      return res.status(404).json({ error: "Parent hospital not found" });
    }
    if (parentHospital.verification?.status !== "VERIFIED") {
      return res.status(400).json({ error: "Branches can only be added under a verified parent hospital." });
    }

    const normalizedRegistrationNumber = String(registrationNumber || "").trim().toUpperCase();
    const branchLicenseIsRequired = branchLicenseRequired === true || branchLicenseRequired === "true";
    let verification = {
      status: "VERIFIED",
      registrationNumber: normalizedRegistrationNumber,
      approvalDate: new Date(),
      verifiedAt: new Date(),
      verifiedBy: req.user?._id || null,
      expiresAt: parentHospital.verification?.expiresAt || null,
      nextReverificationAt: parentHospital.verification?.nextReverificationAt || null,
      publicVisible: true,
      branchLicenseRequired: branchLicenseIsRequired,
      verificationMode: "PARENT_LICENSE",
      reviewNotes: branchLicenseIsRequired
        ? "Branch license required and validated against government registry."
        : "Branch operates under parent hospital verified license.",
    };

    if (branchLicenseIsRequired) {
      if (!normalizedRegistrationNumber) {
        return res.status(400).json({ error: "Branch registration number is required for this branch." });
      }
      const registryHospital = await GovernmentHospitalRegistry.findOne({
        registrationNumber: normalizedRegistrationNumber,
        status: "ACTIVE",
      }).lean();
      if (!registryHospital) {
        return res.status(422).json({ error: "Branch registration number is not present in the approved government registry." });
      }
      verification = {
        ...verification,
        registryHospital: registryHospital._id,
        expiresAt: registryHospital.validUntil || null,
        nextReverificationAt: registryHospital.validUntil || null,
        verificationMode: "BRANCH_LICENSE",
      };
    }

    const branch = await Branch.create({
      hospital,
      name: String(name).trim(),
      location: String(location).trim(),
      contact: {
        email: String(email || "").trim(),
        phone: String(phone || "").trim(),
      },
      parentHospitalName: parentHospital.name || "",
      verification,
      createdBy: req.user?._id,
    });

    await Notification.create({
      title: "Branch Registered",
      body: `${branch.name} was added under ${parentHospital.name}.`,
      category: "SYSTEM",
      hospital,
      user: req.user?._id,
      meta: {
        type: "BRANCH_REGISTERED",
        branchId: branch._id,
      },
    });

    res.status(201).json({ data: branch });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create branch" });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, active, email, phone, verification } = req.body || {};
    const branch = await Branch.findById(id);
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    const userHospital = req.user?.hospital || req.user?.hospitalId || null;
    if (!isPrivileged(req) && String(branch.hospital) !== String(userHospital)) {
      return res.status(403).json({ error: "Cross-hospital access denied" });
    }

    if (name !== undefined) branch.name = String(name).trim();
    if (location !== undefined) branch.location = String(location).trim();
    if (email !== undefined || phone !== undefined) {
      branch.contact = branch.contact || {};
      if (email !== undefined) branch.contact.email = String(email || "").trim();
      if (phone !== undefined) branch.contact.phone = String(phone || "").trim();
    }
    if (active !== undefined) branch.active = Boolean(active);
    if (verification && typeof verification === "object" && isPrivileged(req)) {
      if (verification.status !== undefined) {
        branch.verification.status = String(verification.status).trim().toUpperCase();
      }
      if (verification.reviewNotes !== undefined) {
        branch.verification.reviewNotes = String(verification.reviewNotes || "").trim();
      }
      if (verification.publicVisible !== undefined) {
        branch.verification.publicVisible = Boolean(verification.publicVisible);
      }
      if (branch.verification.status === "VERIFIED") {
        branch.verification.approvalDate = branch.verification.approvalDate || new Date();
        branch.verification.verifiedAt = new Date();
        branch.verification.verifiedBy = req.user?._id || null;
      }
    }

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
