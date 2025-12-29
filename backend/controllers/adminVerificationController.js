import User from "../models/User.js";
import { Parser } from "json2csv";

export const exportExpiringUsersCSV = async (req, res) => {
  const now = new Date();
  const days = Number(req.query.days || 14);

  const limitDate = new Date(
    now.getTime() + days * 24 * 60 * 60 * 1000
  );

  const users = await User.find({
    emailVerified: false,
    verificationDeadline: { $lte: limitDate },
  }).select("name email role verificationDeadline createdAt");

  const parser = new Parser({
    fields: [
      "name",
      "email",
      "role",
      "verificationDeadline",
      "createdAt",
    ],
  });

  const csv = parser.parse(users);

  res.header("Content-Type", "text/csv");
  res.attachment("expiring-unverified-users.csv");
  res.send(csv);
};
