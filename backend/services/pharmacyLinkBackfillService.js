import User from "../models/User.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import AuditLog from "../models/AuditLog.js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function buildMatchMetadata({ email, phone, pharmacy }) {
  return {
    emailMatched: Boolean(email && normalizeEmail(pharmacy?.contact?.email) === email),
    phoneMatched: Boolean(phone && normalizePhone(pharmacy?.contact?.phone) === phone),
  };
}

export async function collectPharmacyLinkBackfillPreview() {
  const pharmacists = await User.find({
    role: "PHARMACIST",
    active: true,
    $or: [{ registeredPharmacy: null }, { registeredPharmacy: { $exists: false } }],
  })
    .select("_id name email phone hospital registeredPharmacy")
    .populate("hospital", "name code")
    .lean();

  const matched = [];
  const ambiguous = [];
  const skipped = [];

  for (const user of pharmacists) {
    const email = normalizeEmail(user.email);
    const phone = normalizePhone(user.phone);
    const or = [];
    if (email) or.push({ "contact.email": email });
    if (phone) or.push({ "contact.phone": phone });

    if (!or.length) {
      skipped.push({
        user,
        reason: "No email or phone available for matching",
      });
      continue;
    }

    const pharmacies = await RegisteredPharmacy.find({
      status: "ACTIVE",
      $or: or,
    })
      .select("_id name licenseNumber contact status")
      .lean();

    if (!pharmacies.length) {
      skipped.push({
        user,
        reason: "No active pharmacy matched the user contact details",
      });
      continue;
    }

    if (pharmacies.length > 1) {
      ambiguous.push({
        user,
        candidates: pharmacies,
      });
      continue;
    }

    const pharmacy = pharmacies[0];
    matched.push({
      user,
      pharmacy,
      ...buildMatchMetadata({ email, phone, pharmacy }),
    });
  }

  return {
    scanned: pharmacists.length,
    matched,
    ambiguous,
    skipped,
  };
}

export async function runPharmacyLinkBackfill({ dryRun = false } = {}) {
  const preview = await collectPharmacyLinkBackfillPreview();

  let updated = 0;
  if (!dryRun) {
    for (const item of preview.matched) {
      await User.updateOne(
        { _id: item.user._id },
        { $set: { registeredPharmacy: item.pharmacy._id } }
      );

      await AuditLog.create({
        actorId: null,
        actorRole: "SYSTEM",
        action: "PHARMACIST_LINKAGE_BACKFILL",
        resource: "User",
        resourceId: item.user._id,
        hospital: item.user.hospital?._id || item.user.hospital || null,
        success: true,
        metadata: {
          linkedPharmacyId: item.pharmacy._id,
          linkedPharmacyName: item.pharmacy.name,
          emailMatched: item.emailMatched,
          phoneMatched: item.phoneMatched,
          dryRun: false,
        },
      });

      updated += 1;
    }
  }

  return {
    scanned: preview.scanned,
    matched: preview.matched,
    ambiguous: preview.ambiguous,
    skipped: preview.skipped,
    updated,
  };
}
