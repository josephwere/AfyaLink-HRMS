import { MENU_CONFIG } from "../config/menu.config.js";

export const buildMenu = ({ user, hospital }) => {
  return MENU_CONFIG.filter((item) => {
    // 🔐 Role restriction
    if (item.roles && !item.roles.includes(user.role)) {
      return false;
    }

    // 🔐 Feature restriction
    if (item.feature && !hospital.features?.[item.feature]) {
      return false;
    }

    return true;
  });
};
