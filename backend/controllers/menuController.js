import Hospital from "../models/Hospital.js";
import { MENU } from "../config/menuConfig.js";

export const getMenu = async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  let hospital = null;
  if (user.hospital) {
    hospital = await Hospital.findById(user.hospital).lean();
  }

  const features = hospital?.features || {};

  const filteredMenu = MENU.filter((section) => {
    if (section.roles && !section.roles.includes(user.role)) return false;
    if (section.feature && !features[section.feature]) return false;
    return true;
  }).map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.hidden || user.role === "SUPER_ADMIN"
    ),
  }));

  res.json(filteredMenu);
};
