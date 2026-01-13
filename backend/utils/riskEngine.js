export const calculateRisk = ({ accessEntry, events = [] }) => {
  let score = 0;
  const factors = [];

  if (events.includes("OVERSTAY")) {
    score += 20;
    factors.push("Overstay");
  }

  if (events.includes("AREA_VIOLATION")) {
    score += 30;
    factors.push("Restricted area attempt");
  }

  if (events.includes("NIGHT_ACCESS")) {
    score += 15;
    factors.push("Night-time access");
  }

  if (events.includes("EMERGENCY_BYPASS")) {
    score += 25;
    factors.push("Emergency override");
  }

  let level = "LOW";
  if (score >= 70) level = "CRITICAL";
  else if (score >= 40) level = "HIGH";
  else if (score >= 20) level = "MEDIUM";

  return { score, level, factors };
};
