import User from "../models/User.js";
import { Parser } from "json2csv";
import { normalizeRole } from "../utils/normalizeRole.js";
import { recordExportEvent } from "../utils/exportAudit.js";

export const exportExpiringUsersCSV = async (req, res) => {
  const now = new Date();
  const days = Math.min(Math.max(Number(req.query.days || 14), 1), 60);
  const maxRows = Math.min(Math.max(Number(req.query.maxRows || 1000), 1), 5000);

  const limitDate = new Date(
    now.getTime() + days * 24 * 60 * 60 * 1000
  );

  const role = normalizeRole(req.user?.role || "");
  const query = {
    emailVerified: false,
    verificationDeadline: { $lte: limitDate },
  };
  if (role === "HOSPITAL_ADMIN") {
    query.hospital = req.user?.hospital || req.user?.hospitalId;
  }

  const users = await User.find(query)
    .select("name email role verificationDeadline createdAt hospital")
    .sort({ verificationDeadline: 1 })
    .limit(maxRows)
    .lean();

  const parser = new Parser({
    fields: [
      "name",
      "email",
      "role",
      "verificationDeadline",
      "createdAt",
      "hospital",
    ],
  });

  const csv = parser.parse(users);

  await recordExportEvent({
    req,
    action: "EXPORT_UNVERIFIED_USERS_CSV",
    resource: "User",
    format: "CSV",
    rowCount: users.length,
    metadata: { days, maxRows, hospitalScoped: role === "HOSPITAL_ADMIN" },
  });

  res.header("Content-Type", "text/csv");
  res.attachment("expiring-unverified-users.csv");
  res.send(csv);
};
