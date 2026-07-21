import { useEffect, useMemo, useState } from "react";
import { getPatientDashboard } from "../services/dashboardApi";
import { listPharmacyReferrals } from "../services/pharmacyNetworkApi";
import { guardedConsoleFetch } from "../services/guardedConsoleFetch";

export function usePatientDashboard() {
  const [data, setData] = useState(null);
  const [latestVisit, setLatestVisit] = useState(null);
  const [latestEncounter, setLatestEncounter] = useState(null);
  const [latestPrescription, setLatestPrescription] = useState(null);
  const [latestReferral, setLatestReferral] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const [dashboardResult, appointmentsResult, encountersResult, prescriptionsResult, referralsResult] =
        await Promise.allSettled([
          getPatientDashboard(),
          guardedConsoleFetch("/api/appointments?limit=10", {
            warmupKey: "patient-dashboard-appointments",
          }).then((result) => result?.payload || null),
          guardedConsoleFetch("/api/encounters?limit=1", {
            warmupKey: "patient-dashboard-encounters",
          }).then((result) => result?.payload || null),
          guardedConsoleFetch("/api/pharmacy/prescriptions", {
            warmupKey: "patient-dashboard-prescriptions",
          }).then((result) => result?.payload || null),
          listPharmacyReferrals({ limit: 20 }),
        ]);

      if (!active) return;

      setData(dashboardResult.status === "fulfilled" ? dashboardResult.value : null);

      if (appointmentsResult.status === "fulfilled") {
        const rows = Array.isArray(appointmentsResult.value?.items) ? appointmentsResult.value.items : [];
        const latestCompleted = rows.find(
          (item) => item?.metadata?.consultationSummary || item?.notes || item?.status === "Completed"
        );
        setLatestVisit(latestCompleted || null);
      } else {
        setLatestVisit(null);
      }

      if (encountersResult.status === "fulfilled") {
        const items = Array.isArray(encountersResult.value) ? encountersResult.value : [];
        setLatestEncounter(items[0] || null);
      } else {
        setLatestEncounter(null);
      }

      if (prescriptionsResult.status === "fulfilled") {
        const rows = Array.isArray(prescriptionsResult.value?.items) ? prescriptionsResult.value.items : [];
        setLatestPrescription(rows[0] || null);
      } else {
        setLatestPrescription(null);
      }

      if (referralsResult.status === "fulfilled") {
        const rows = Array.isArray(referralsResult.value?.items) ? referralsResult.value.items : [];
        setLatestReferral(rows[0] || null);
      } else {
        setLatestReferral(null);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  return { data, latestVisit, latestEncounter, latestPrescription, latestReferral };
}

export default usePatientDashboard;
