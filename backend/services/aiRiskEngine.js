export const evaluateRisk = ({ entry, history }) => {
  let riskScore = 0;
  const reasons = [];

  if (history.denials >= 3) {
    riskScore += 40;
    reasons.push("Repeated access denial");
  }

  if (new Date().getHours() < 5) {
    riskScore += 20;
    reasons.push("After-hours access");
  }

  if (entry.areaViolation) {
    riskScore += 30;
    reasons.push("Restricted area attempt");
  }

  return {
    riskScore,
    escalate: riskScore >= 50,
    reasons,
  };
};
