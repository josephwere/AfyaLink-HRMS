import Notification from "../models/Notification.js";
import TrainingTracker from "../models/TrainingTracker.js";
import User from "../models/User.js";

const MS_DAY = 24 * 60 * 60 * 1000;
const NOT_STARTED_OVERDUE_DAYS = 3;
const IN_PROGRESS_STALE_DAYS = 7;
const DEDUPE_WINDOW_DAYS = 3;

const MANAGER_ROLES = ["HOSPITAL_ADMIN", "HR_MANAGER"];
const GLOBAL_ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"];

function buildAlertPayload(tracker) {
  const now = Date.now();
  const createdAt = tracker.createdAt ? new Date(tracker.createdAt).getTime() : now;
  const updatedAt = tracker.updatedAt ? new Date(tracker.updatedAt).getTime() : createdAt;

  if (
    tracker.status === "NOT_STARTED" &&
    createdAt <= now - NOT_STARTED_OVERDUE_DAYS * MS_DAY
  ) {
    return {
      alertType: "NOT_STARTED_OVERDUE",
      title: "Training Overdue: Not Started",
      body: `${tracker.traineeName} (${tracker.traineeRole}) has not started onboarding after ${NOT_STARTED_OVERDUE_DAYS} days.`,
      path: `/admin/training-tracker?status=NOT_STARTED&role=${encodeURIComponent(
        tracker.traineeRole || ""
      )}`,
    };
  }

  if (
    tracker.status === "IN_PROGRESS" &&
    updatedAt <= now - IN_PROGRESS_STALE_DAYS * MS_DAY
  ) {
    return {
      alertType: "IN_PROGRESS_STALE",
      title: "Training Stalled: In Progress",
      body: `${tracker.traineeName} (${tracker.traineeRole}) has no onboarding progress for ${IN_PROGRESS_STALE_DAYS}+ days.`,
      path: `/admin/training-tracker?status=IN_PROGRESS&role=${encodeURIComponent(
        tracker.traineeRole || ""
      )}`,
    };
  }

  return null;
}

export async function runTrainingOverdueSweep() {
  const now = new Date();
  const notStartedCutoff = new Date(now.getTime() - NOT_STARTED_OVERDUE_DAYS * MS_DAY);
  const staleCutoff = new Date(now.getTime() - IN_PROGRESS_STALE_DAYS * MS_DAY);
  const dedupeCutoff = new Date(now.getTime() - DEDUPE_WINDOW_DAYS * MS_DAY);

  const trackers = await TrainingTracker.find({
    $or: [
      { status: "NOT_STARTED", createdAt: { $lte: notStartedCutoff } },
      { status: "IN_PROGRESS", updatedAt: { $lte: staleCutoff } },
    ],
  })
    .select("hospital traineeName traineeEmail traineeRole status progressPercent createdAt updatedAt")
    .lean();

  if (!trackers.length) {
    return { scanned: 0, created: 0 };
  }

  const globalUsers = await User.find({
    role: { $in: GLOBAL_ROLES },
    active: { $ne: false },
  })
    .select("_id")
    .lean();
  const globalUserIds = globalUsers.map((u) => String(u._id));

  let created = 0;

  for (const tracker of trackers) {
    const alert = buildAlertPayload(tracker);
    if (!alert) continue;

    const hospitalManagers = await User.find({
      hospital: tracker.hospital || null,
      role: { $in: MANAGER_ROLES },
      active: { $ne: false },
    })
      .select("_id")
      .lean();

    const recipientIds = Array.from(
      new Set([...globalUserIds, ...hospitalManagers.map((u) => String(u._id))])
    );

    if (!recipientIds.length) continue;

    const existing = await Notification.find({
      user: { $in: recipientIds },
      category: "TRAINING",
      "meta.trainingTrackerId": String(tracker._id),
      "meta.alertType": alert.alertType,
      createdAt: { $gte: dedupeCutoff },
    })
      .select("user")
      .lean();
    const existingUsers = new Set(existing.map((n) => String(n.user)));

    const docs = recipientIds
      .filter((uid) => !existingUsers.has(uid))
      .map((uid) => ({
        title: alert.title,
        body: alert.body,
        category: "TRAINING",
        user: uid,
        hospital: tracker.hospital || null,
        read: false,
        meta: {
          trainingTrackerId: String(tracker._id),
          traineeName: tracker.traineeName,
          traineeEmail: tracker.traineeEmail || "",
          traineeRole: tracker.traineeRole,
          progressPercent: tracker.progressPercent || 0,
          status: tracker.status,
          alertType: alert.alertType,
          path: alert.path,
        },
      }));

    if (docs.length) {
      await Notification.insertMany(docs);
      created += docs.length;
    }
  }

  return { scanned: trackers.length, created };
}

