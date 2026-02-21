import { trainModelPlaceholder, predictWithModelPlaceholder } from '../utils/aiAdvanced.js';
import User from "../models/User.js";
import ShiftRequest from "../models/ShiftRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import LeaveRequest from "../models/LeaveRequest.js";

export const trainModel = async (req, res, next) => {
  try {
    const data = req.body;
    const out = await trainModelPlaceholder(data);
    res.json(out);
  } catch (err) { next(err); }
};

export const predictModel = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const input = req.body;
    const out = await predictWithModelPlaceholder(modelId, input);
    res.json(out);
  } catch (err) { next(err); }
};

export const staffingForecast = async (req, res, next) => {
  try {
    const {
      beds = 100,
      occupancyRate = 0.75,
      avgPatientsPerDoctor = 12,
      avgPatientsPerNurse = 5,
      horizonDays = 14,
    } = req.body || {};
    const hospital = req.user?.hospital || req.user?.hospitalId || null;
    const occupiedBeds = Math.max(0, Number(beds) * Number(occupancyRate));
    const requiredDoctors = Math.ceil(occupiedBeds / Math.max(1, Number(avgPatientsPerDoctor)));
    const requiredNurses = Math.ceil(occupiedBeds / Math.max(1, Number(avgPatientsPerNurse)));

    const [activeDoctors, activeNurses] = await Promise.all([
      User.countDocuments({ ...(hospital ? { hospital } : {}), role: "DOCTOR", active: { $ne: false } }),
      User.countDocuments({ ...(hospital ? { hospital } : {}), role: "NURSE", active: { $ne: false } }),
    ]);

    return res.json({
      ok: true,
      horizonDays: Number(horizonDays),
      assumptions: { beds, occupancyRate, avgPatientsPerDoctor, avgPatientsPerNurse },
      forecast: {
        occupiedBeds,
        requiredDoctors,
        requiredNurses,
        currentDoctors: activeDoctors,
        currentNurses: activeNurses,
        doctorGap: requiredDoctors - activeDoctors,
        nurseGap: requiredNurses - activeNurses,
      },
    });
  } catch (err) { next(err); }
};

export const burnoutScore = async (req, res, next) => {
  try {
    const {
      hoursPerWeek = 45,
      nightShifts = 4,
      consecutiveDays = 6,
      overtimeHours = 8,
      leaveBalanceDays = 12,
      incidentsIn30d = 0,
    } = req.body || {};

    const score = Math.max(
      0,
      Math.min(
        100,
        Number(hoursPerWeek) * 0.5 +
          Number(nightShifts) * 4 +
          Number(consecutiveDays) * 3 +
          Number(overtimeHours) * 1.2 +
          Number(incidentsIn30d) * 5 -
          Number(leaveBalanceDays) * 0.7
      )
    );

    const band = score >= 75 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
    return res.json({
      ok: true,
      score: Number(score.toFixed(2)),
      band,
      recommendations: [
        ...(band !== "LOW" ? ["Reduce consecutive shifts", "Auto-prioritize leave approval"] : []),
        ...(band === "HIGH" ? ["Immediate workload redistribution", "Mandatory wellbeing check-in"] : []),
      ],
    });
  } catch (err) { next(err); }
};

export const causalImpact = async (req, res, next) => {
  try {
    const {
      baseline = 100,
      interventions = [],
    } = req.body || {};
    let projected = Number(baseline);
    const applied = [];
    for (const item of interventions) {
      const pct = Number(item?.effectPct || 0);
      const confidence = Math.max(0, Math.min(1, Number(item?.confidence || 1)));
      const delta = projected * (pct / 100) * confidence;
      projected += delta;
      applied.push({
        name: item?.name || "intervention",
        effectPct: pct,
        confidence,
        delta: Number(delta.toFixed(3)),
      });
    }
    return res.json({
      ok: true,
      baseline: Number(baseline),
      projected: Number(projected.toFixed(3)),
      changePct: Number((((projected - Number(baseline)) / Math.max(1, Number(baseline))) * 100).toFixed(2)),
      applied,
    });
  } catch (err) { next(err); }
};

export const digitalTwinSimulate = async (req, res, next) => {
  try {
    const hospital = req.user?.hospital || req.user?.hospitalId || null;
    const departments = Array.isArray(req.body?.departments) ? req.body.departments : [];

    const [pendingShift, pendingOvertime, pendingLeave] = await Promise.all([
      ShiftRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
      OvertimeRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
      LeaveRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
    ]);

    const simulated = departments.map((d) => {
      const staff = Math.max(0, Number(d.staff || 0));
      const demand = Math.max(0, Number(d.demand || 0));
      const absenteeismRate = Math.max(0, Math.min(1, Number(d.absenteeismRate || 0)));
      const effectiveStaff = staff * (1 - absenteeismRate);
      const gap = demand - effectiveStaff;
      return {
        name: d.name || "Department",
        staff,
        demand,
        absenteeismRate,
        effectiveStaff: Number(effectiveStaff.toFixed(2)),
        gap: Number(gap.toFixed(2)),
        status: gap > 0 ? "UNDER_CAPACITY" : "BALANCED",
      };
    });

    return res.json({
      ok: true,
      twin: {
        pendingRequests: {
          shifts: pendingShift,
          overtime: pendingOvertime,
          leave: pendingLeave,
        },
        departments: simulated,
      },
      actions: [
        "Re-route non-critical workload to balanced departments",
        "Auto-suggest overtime where under-capacity persists > 2 days",
        "Escalate staffing shortage if gap exceeds 20%",
      ],
    });
  } catch (err) { next(err); }
};
