import { useCallback } from "react";
import {
  createLeave as createLeaveApi,
  createOvertime as createOvertimeApi,
  createShift as createShiftApi,
  listMyLeave as listMyLeaveApi,
  listMyOvertime as listMyOvertimeApi,
  listMyShifts as listMyShiftsApi,
} from "../services/workforceApi";

export function useWorkforceMyRequests() {
  const listMyLeave = useCallback((status, options) => listMyLeaveApi(status, options), []);
  const listMyOvertime = useCallback((status, options) => listMyOvertimeApi(status, options), []);
  const listMyShifts = useCallback((status, options) => listMyShiftsApi(status, options), []);
  const createLeave = useCallback((payload) => createLeaveApi(payload), []);
  const createOvertime = useCallback((payload) => createOvertimeApi(payload), []);
  const createShift = useCallback((payload) => createShiftApi(payload), []);

  return {
    listMyLeave,
    listMyOvertime,
    listMyShifts,
    createLeave,
    createOvertime,
    createShift,
  };
}

export default useWorkforceMyRequests;
