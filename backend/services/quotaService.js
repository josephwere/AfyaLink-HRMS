export async function enforceQuota(hospital, metric, count) {
  if (!hospital.limits?.[metric]) return;

  if (count >= hospital.limits[metric]) {
    throw new Error(`Quota exceeded: ${metric}`);
  }
}
