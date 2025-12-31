export const redirectByRole = (user) => {
  if (!user || !user.role) return "/";

  /* --------------------
     Patient
  -------------------- */
  if (user.role === "PATIENT") {
    return "/patient";
  }

  /* --------------------
     Clinical staff
  -------------------- */
  const staffRoles = [
    "DOCTOR",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "RADIOLOGIST",
    "THERAPIST",
    "RECEPTIONIST",
  ];

  if (staffRoles.includes(user.role)) {
    return "/staff";
  }

  /* --------------------
     Admins
  -------------------- */
  if (user.role === "SUPER_ADMIN" || user.role === "HOSPITAL_ADMIN") {
    return "/admin";
  }

  return "/";
};
