import apiFetch from "../../utils/apiFetch.js";

export async function getWorkCenter() {
  return apiFetch(`/api/finance/work-center`);
}
