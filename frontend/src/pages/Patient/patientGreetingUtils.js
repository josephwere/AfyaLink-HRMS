export function getPersonalizedGreeting(user = {}, now = new Date()) {
  const hour = now.getHours();
  let prefix = "Good Morning";
  if (hour >= 12 && hour < 18) prefix = "Good Afternoon";
  else if (hour >= 18) prefix = "Good Evening";

  const name = String(user?.name || user?.firstName || user?.fullName || "").trim();
  const role = String(user?.role || "").toUpperCase();
  const displayName = name || "there";

  if (role === "DOCTOR" && displayName !== "there") {
    return `${prefix}, Dr. ${displayName}`;
  }

  return `${prefix}, ${displayName}`;
}
