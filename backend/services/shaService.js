/**
 * SHA SERVICE
 * - External insurance integration
 * - Can be mocked or real
 * - NEVER mutates workflow directly
 */

export async function requestShaPreauth({ encounter, patient }) {
  /**
   * 🔐 REAL IMPLEMENTATION:
   * - Call SHA API
   * - Send patient + diagnosis + cost estimate
   *
   * For now: deterministic mock
   */

  // Simulate delay
  await new Promise((r) => setTimeout(r, 500));

  // Simulate approval logic
  const approved = true;

  if (!approved) {
    return {
      status: "REJECTED",
      reason: "Coverage not found",
    };
  }

  return {
    status: "APPROVED",
    authorizationCode: "SHA-" + Date.now(),
  };
}
