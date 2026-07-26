export function shouldShowMapSelectionCard(selectedMapHospitalId, hospitalId) {
  const selectedId = String(selectedMapHospitalId || hospitalId || "").trim();
  return Boolean(selectedId);
}
