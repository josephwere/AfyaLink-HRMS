import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import PharmacyReferral from "../models/PharmacyReferral.js";
import { normalizeRole } from "../utils/normalizeRole.js";

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);

function actorRole(req) {
  return normalizeRole(req.user?.actualRole || req.user?.role || "");
}

function actorHospital(req) {
  return req.user?.hospitalId || req.user?.hospital || null;
}

export const listRegisteredPharmacies = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const lat = toNumberOrNull(req.query.lat);
    const lng = toNumberOrNull(req.query.lng);
    const radiusKm = Math.max(Number(req.query.radiusKm || 50), 1);
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 300);

    const filter = {};
    if (!includeInactive) filter.status = "ACTIVE";
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { licenseNumber: { $regex: q, $options: "i" } },
        { "location.country": { $regex: q, $options: "i" } },
        { "location.region": { $regex: q, $options: "i" } },
        { "location.city": { $regex: q, $options: "i" } },
        { "location.address": { $regex: q, $options: "i" } },
      ];
    }

    const rows = await RegisteredPharmacy.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const hasPoint = lat !== null && lng !== null;
    const items = rows
      .map((row) => {
        const pLat = toNumberOrNull(row?.location?.lat);
        const pLng = toNumberOrNull(row?.location?.lng);
        const distanceKm =
          hasPoint && pLat !== null && pLng !== null
            ? haversineKm(lat, lng, pLat, pLng)
            : null;
        return { ...row, distanceKm };
      })
      .filter((row) => {
        if (!hasPoint || row.distanceKm === null) return true;
        return row.distanceKm <= radiusKm;
      })
      .sort((a, b) => {
        if (!hasPoint) return String(a.name || "").localeCompare(String(b.name || ""));
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });

    return res.json({ success: true, items });
  } catch (err) {
    return next(err);
  }
};

export const createRegisteredPharmacy = async (req, res, next) => {
  try {
    if (!PRIVILEGED_ROLES.has(actorRole(req))) {
      return res.status(403).json({ message: "Access denied" });
    }

    const name = String(req.body?.name || "").trim();
    const licenseNumber = String(req.body?.licenseNumber || "").trim().toUpperCase();
    if (!name || !licenseNumber) {
      return res.status(422).json({ message: "name and licenseNumber are required" });
    }

    const pharmacy = await RegisteredPharmacy.create({
      name,
      licenseNumber,
      governmentRegistryId: String(req.body?.governmentRegistryId || "").trim(),
      status: req.body?.status || "ACTIVE",
      contact: {
        phone: String(req.body?.contact?.phone || req.body?.phone || "").trim(),
        email: String(req.body?.contact?.email || req.body?.email || "").trim(),
      },
      location: {
        country: String(req.body?.location?.country || req.body?.country || "").trim(),
        region: String(req.body?.location?.region || req.body?.region || "").trim(),
        city: String(req.body?.location?.city || req.body?.city || "").trim(),
        address: String(req.body?.location?.address || req.body?.address || "").trim(),
        lat: toNumberOrNull(req.body?.location?.lat ?? req.body?.lat),
        lng: toNumberOrNull(req.body?.location?.lng ?? req.body?.lng),
      },
      services: Array.isArray(req.body?.services)
        ? req.body.services.map((s) => String(s).trim()).filter(Boolean)
        : [],
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({ success: true, pharmacy });
  } catch (err) {
    return next(err);
  }
};

export const updateRegisteredPharmacy = async (req, res, next) => {
  try {
    if (!PRIVILEGED_ROLES.has(actorRole(req))) {
      return res.status(403).json({ message: "Access denied" });
    }

    const pharmacy = await RegisteredPharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });

    if (req.body?.name !== undefined) pharmacy.name = String(req.body.name || "").trim() || pharmacy.name;
    if (req.body?.licenseNumber !== undefined) {
      const nextLicense = String(req.body.licenseNumber || "").trim().toUpperCase();
      if (nextLicense) pharmacy.licenseNumber = nextLicense;
    }
    if (req.body?.governmentRegistryId !== undefined) {
      pharmacy.governmentRegistryId = String(req.body.governmentRegistryId || "").trim();
    }
    if (req.body?.status !== undefined) pharmacy.status = req.body.status;

    const location = req.body?.location || req.body || {};
    if (location.country !== undefined) pharmacy.location.country = String(location.country || "").trim();
    if (location.region !== undefined) pharmacy.location.region = String(location.region || "").trim();
    if (location.city !== undefined) pharmacy.location.city = String(location.city || "").trim();
    if (location.address !== undefined) pharmacy.location.address = String(location.address || "").trim();
    if (location.lat !== undefined) pharmacy.location.lat = toNumberOrNull(location.lat);
    if (location.lng !== undefined) pharmacy.location.lng = toNumberOrNull(location.lng);

    const contact = req.body?.contact || req.body || {};
    if (contact.phone !== undefined) pharmacy.contact.phone = String(contact.phone || "").trim();
    if (contact.email !== undefined) pharmacy.contact.email = String(contact.email || "").trim();

    if (req.body?.services !== undefined) {
      pharmacy.services = Array.isArray(req.body.services)
        ? req.body.services.map((s) => String(s).trim()).filter(Boolean)
        : [];
    }

    pharmacy.updatedBy = req.user?._id || null;
    await pharmacy.save();

    return res.json({ success: true, pharmacy });
  } catch (err) {
    return next(err);
  }
};

export const createPharmacyReferral = async (req, res, next) => {
  try {
    const hospital = actorHospital(req);
    if (!hospital) {
      return res.status(400).json({ message: "Hospital context is required for referrals" });
    }

    const pharmacyId = String(req.body?.pharmacyId || "").trim();
    const patientName = String(req.body?.patientName || "").trim();
    if (!pharmacyId || !patientName) {
      return res.status(422).json({ message: "pharmacyId and patientName are required" });
    }

    const pharmacy = await RegisteredPharmacy.findById(pharmacyId).lean();
    if (!pharmacy || pharmacy.status !== "ACTIVE") {
      return res.status(404).json({ message: "Target pharmacy not found or inactive" });
    }

    const referral = await PharmacyReferral.create({
      hospital,
      pharmacy: pharmacy._id,
      patientName,
      patientPhone: String(req.body?.patientPhone || "").trim(),
      reason: String(req.body?.reason || "").trim(),
      medicationNotes: String(req.body?.medicationNotes || "").trim(),
      urgent: Boolean(req.body?.urgent),
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    const populated = await PharmacyReferral.findById(referral._id)
      .populate("pharmacy", "name licenseNumber contact location status")
      .populate("createdBy", "name role")
      .lean();

    return res.status(201).json({ success: true, referral: populated });
  } catch (err) {
    return next(err);
  }
};

export const listPharmacyReferrals = async (req, res, next) => {
  try {
    const role = actorRole(req);
    const filter = {};

    if (PRIVILEGED_ROLES.has(role)) {
      if (req.query.hospitalId) filter.hospital = req.query.hospitalId;
    } else {
      const hospital = actorHospital(req);
      if (!hospital) return res.status(400).json({ message: "Hospital context missing" });
      filter.hospital = hospital;
    }

    if (req.query.pharmacyId) filter.pharmacy = req.query.pharmacyId;
    if (req.query.status) filter.status = req.query.status;

    const items = await PharmacyReferral.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("pharmacy", "name licenseNumber contact location status")
      .populate("createdBy", "name role")
      .lean();

    return res.json({ success: true, items });
  } catch (err) {
    return next(err);
  }
};
