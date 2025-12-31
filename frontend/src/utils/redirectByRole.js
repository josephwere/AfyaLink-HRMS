export const redirectByRole = (user) => {
  if (!user || !user.role) return "/";

  switch (user.role) {
    case "PATIENT":
      return "/patient";

    case "DOCTOR":
      return "/doctor";

    case "SUPER_ADMIN":
    case "HOSPITAL_ADMIN":
      return "/admin";

    default:
      return "/";
  }
};
