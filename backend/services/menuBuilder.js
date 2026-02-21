import { MENU_CONFIG } from "../config/menu.config.js";

export const buildMenu = ({ user, hospital }) => {
  return MENU_CONFIG.filter((section) => {
    // 🔐 Role gate
    if (section.roles && !section.roles.includes(user.role)) {
      return false;
    }

    // 🔐 Feature gate
    if (section.feature && !hospital.features?.[section.feature]) {
      return false;
    }

    return true;
  }).map((section) => ({
    ...section,
    items: section.items.filter(Boolean),
  }));
};
