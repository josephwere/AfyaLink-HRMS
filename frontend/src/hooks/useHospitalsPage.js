import { useCallback } from "react";
import {
  createHospital as createHospitalApi,
  updateHospital as updateHospitalApi,
  searchGovernmentHospitals as searchGovernmentHospitalsApi,
} from "../services/hospitalApi";
import {
  createBranch as createBranchApi,
  listBranches as listBranchesApi,
  removeBranch as removeBranchApi,
  updateBranch as updateBranchApi,
} from "../services/branchesApi";
import {
  listHospitals as listHospitalsApi,
  listHospitalAdmins as listHospitalAdminsApi,
  registerHospitalAdmin as registerHospitalAdminApi,
  registerSystemAdmin as registerSystemAdminApi,
  registerDeveloper as registerDeveloperApi,
  updateHospitalAdmin as updateHospitalAdminApi,
} from "../services/superAdminApi";

export function useHospitalsPage() {
  const createHospital = useCallback((payload) => createHospitalApi(payload), []);
  const updateHospital = useCallback((id, payload) => updateHospitalApi(id, payload), []);
  const searchGovernmentHospitals = useCallback((params) => searchGovernmentHospitalsApi(params), []);
  const createBranch = useCallback((payload) => createBranchApi(payload), []);
  const listBranches = useCallback((hospitalId) => listBranchesApi(hospitalId), []);
  const removeBranch = useCallback((id) => removeBranchApi(id), []);
  const updateBranch = useCallback((id, payload) => updateBranchApi(id, payload), []);
  const listHospitals = useCallback((params) => listHospitalsApi(params), []);
  const listHospitalAdmins = useCallback((params) => listHospitalAdminsApi(params), []);
  const registerHospitalAdmin = useCallback((payload) => registerHospitalAdminApi(payload), []);
  const registerSystemAdmin = useCallback((payload) => registerSystemAdminApi(payload), []);
  const registerDeveloper = useCallback((payload) => registerDeveloperApi(payload), []);
  const updateHospitalAdmin = useCallback((id, payload) => updateHospitalAdminApi(id, payload), []);

  return {
    createHospital,
    updateHospital,
    searchGovernmentHospitals,
    createBranch,
    listBranches,
    removeBranch,
    updateBranch,
    listHospitals,
    listHospitalAdmins,
    registerHospitalAdmin,
    registerSystemAdmin,
    registerDeveloper,
    updateHospitalAdmin,
  };
}

export default useHospitalsPage;
