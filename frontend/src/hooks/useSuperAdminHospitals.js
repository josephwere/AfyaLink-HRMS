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

export const createHospital = createHospitalApi;
export const updateHospital = updateHospitalApi;
export const searchGovernmentHospitals = searchGovernmentHospitalsApi;
export const createBranch = createBranchApi;
export const listBranches = listBranchesApi;
export const removeBranch = removeBranchApi;
export const updateBranch = updateBranchApi;
export const listHospitals = listHospitalsApi;
export const listHospitalAdmins = listHospitalAdminsApi;
export const registerHospitalAdmin = registerHospitalAdminApi;
export const registerSystemAdmin = registerSystemAdminApi;
export const registerDeveloper = registerDeveloperApi;
export const updateHospitalAdmin = updateHospitalAdminApi;

export default {
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
