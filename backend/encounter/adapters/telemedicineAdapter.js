export function createTelemedicineAdapter() {
  return {
    type: "telemedicine",
    connect() {
      return { ok: true, mode: "telemedicine" };
    },
  };
}
