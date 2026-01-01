/**
 * Frontend role → landing route
 * MUST stay aligned with backend role enum + requireRole()
 */

const ROLE_REDIRECT_MAP = Object.freeze({
  // 🔑 Super & system admins
  SUPER_ADMIN: "/admin",
  HOSPITAL_ADMIN: "/admin",

  // 🩺 Clinical staff
  DOCTOR: "/staff",
  NURSE: "/staff",
  LAB_TECH: "/staff",
  PHARMACIST: "/staff",

  // 👤 End users
  PATIENT: "/patient",
  GUEST: "/",

  // 🚨 future-proof (backend may add later)
  // RADIOLOGIST: "/staff",
  // THERAPIST: "/staff",
  // RECEPTIONIST: "/staff",
});

/**
 * Redirect user to correct home by role
 * @param {object} user
 * @returns {string}
 */
export const redirectByRole = (user) => {
  if (!user?.role) return "/login";

  return ROLE_REDIRECT_MAP[user.role] || "/403";
};
