import express from 'express';
import { integrationQueue } from '../services/integrationQueue.js';
import Audit from '../models/Audit.js';
import OfflineClientMetric from "../models/OfflineClientMetric.js";
import { incrementMetricCounter } from "../utils/metrics.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";


const router = express.Router();
const METRICS_DEDUPE_WINDOW_MS = 30 * 1000;
const recentMetricWrites = new Map();

function buildMetricSignature(deviceId, userId, snapshot, modules) {
  return JSON.stringify({
    deviceId: String(deviceId || ""),
    userId: String(userId || ""),
    queueLength: Number(snapshot?.queueLength || 0),
    queuedTotal: Number(snapshot?.lifetime?.enqueued || 0),
    syncedTotal: Number(snapshot?.lifetime?.synced || 0),
    failedTotal: Number(snapshot?.lifetime?.failed || 0),
    lastEnqueueAt: snapshot?.lastEnqueueAt || null,
    lastSyncAt: snapshot?.lastSyncAt || null,
    lastFailureAt: snapshot?.lastFailureAt || null,
    online: snapshot?.online !== false,
    modules,
  });
}

function pruneRecentMetricWrites(now = Date.now()) {
  for (const [key, value] of recentMetricWrites.entries()) {
    if (now - Number(value?.updatedAt || 0) > METRICS_DEDUPE_WINDOW_MS) {
      recentMetricWrites.delete(key);
    }
  }
}

router.post("/metrics", protect, async (req, res) => {
  try {
    const { deviceId, snapshot } = req.body || {};
    if (!deviceId || typeof deviceId !== "string") {
      incrementMetricCounter(
        "afyalink_offline_metrics_ingest_total",
        { outcome: "invalid" },
        1,
        "Offline client metrics ingest outcomes."
      );
      return res.status(400).json({ ok: false, message: "deviceId is required" });
    }

    const pendingByModule = snapshot?.pendingByModule || {};
    const modules = Object.entries(pendingByModule).map(([module, pending]) => ({
      module: String(module || "GLOBAL"),
      pending: Number(pending || 0),
      retryFailures: Number(snapshot?.lifetime?.failed || 0),
    }));
    const dedupeKey = `${String(req.user?._id || "anon")}::${deviceId}`;
    const signature = buildMetricSignature(deviceId, req.user?._id, snapshot, modules);
    const now = Date.now();
    const previous = recentMetricWrites.get(dedupeKey);

    if (
      previous &&
      previous.signature === signature &&
      now - Number(previous.updatedAt || 0) < METRICS_DEDUPE_WINDOW_MS
    ) {
      incrementMetricCounter(
        "afyalink_offline_metrics_ingest_total",
        { outcome: "skipped" },
        1,
        "Offline client metrics ingest outcomes."
      );
      return res.json({ ok: true, skipped: true });
    }

    recentMetricWrites.set(dedupeKey, {
      signature,
      updatedAt: now,
    });
    if (recentMetricWrites.size > 5000) {
      pruneRecentMetricWrites(now);
    }

    await OfflineClientMetric.findOneAndUpdate(
      { user: req.user?._id, deviceId },
      {
        $set: {
          hospital: req.user?.hospital || null,
          role: req.user?.role || null,
          online: snapshot?.online !== false,
          queueLength: Number(snapshot?.queueLength || 0),
          queuedTotal: Number(snapshot?.lifetime?.enqueued || 0),
          syncedTotal: Number(snapshot?.lifetime?.synced || 0),
          failedTotal: Number(snapshot?.lifetime?.failed || 0),
          lastEnqueueAt: snapshot?.lastEnqueueAt || null,
          lastSyncAt: snapshot?.lastSyncAt || null,
          lastFailureAt: snapshot?.lastFailureAt || null,
          modules,
          clientUpdatedAt: new Date(),
        },
      },
      { upsert: true, setDefaultsOnInsert: true, new: true }
    );

    incrementMetricCounter(
      "afyalink_offline_metrics_ingest_total",
      { outcome: "saved" },
      1,
      "Offline client metrics ingest outcomes."
    );
    res.json({ ok: true });
  } catch (err) {
    incrementMetricCounter(
      "afyalink_offline_metrics_ingest_total",
      { outcome: "failed" },
      1,
      "Offline client metrics ingest outcomes."
    );
    res.status(500).json({ ok: false, message: err.message || "Failed to save metrics" });
  }
});

router.use(
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER")
);

// Upload cached events from offline clients - accept an array of { connectorId, payload, sig }
router.post('/upload', async (req,res)=>{
  try{
    const items = req.body.items || [];
    for(const it of items){
      await integrationQueue.add(it);
    }
    await Audit.create({ actor: req.user?._id, action:'offline_upload', details:{ count: items.length }, ip: req.ip });
    res.json({ ok:true, queued: items.length });
  }catch(err){ console.error('offline upload', err); res.status(500).json({ error: err.message }); }
});

// Check sync status - simple placeholder
router.get('/status', async (req,res)=>{
  // return queue counts
  try{
    const counts = { integrationQueue: await integrationQueue.count(), dlq: await (await import('../services/integrationQueue.js')).integrationDLQ.count() };
    res.json({ ok:true, counts });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

router.get("/metrics", async (req, res) => {
  try {
    const hours = Math.max(1, Math.min(720, Number(req.query.hours || 72)));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const limit = Math.max(10, Math.min(500, Number(req.query.limit || 200)));
    const q = String(req.query.q || "").trim().toLowerCase();
    const hospitalId = req.query.hospitalId ? String(req.query.hospitalId) : null;

    const filter = { clientUpdatedAt: { $gte: since } };
    if (req.user?.role === "HOSPITAL_ADMIN") {
      filter.hospital = req.user?.hospital || null;
    } else if (hospitalId) {
      filter.hospital = hospitalId;
    }

    const rows = await OfflineClientMetric.find(filter)
      .sort({ clientUpdatedAt: -1 })
      .limit(limit)
      .populate("user", "name email")
      .populate("hospital", "name")
      .lean();

    const filtered = q
      ? rows.filter((r) =>
          [r?.user?.name, r?.user?.email, r?.hospital?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : rows;

    const byModuleMap = new Map();
    let pendingQueued = 0;
    let retryFailures = 0;
    let lastSyncAt = null;

    for (const row of filtered) {
      pendingQueued += Number(row.queueLength || 0);
      retryFailures += Number(row.failedTotal || 0);
      if (row.lastSyncAt && (!lastSyncAt || new Date(row.lastSyncAt) > new Date(lastSyncAt))) {
        lastSyncAt = row.lastSyncAt;
      }

      for (const mod of row.modules || []) {
        const key = String(mod.module || "GLOBAL").toUpperCase();
        const curr = byModuleMap.get(key) || {
          module: key,
          pending: 0,
          retryFailures: 0,
          clients: 0,
          lastSeenAt: null,
          _clientSet: new Set(),
        };
        curr.pending += Number(mod.pending || 0);
        curr.retryFailures += Number(mod.retryFailures || 0);
        curr._clientSet.add(String(row._id));
        if (!curr.lastSeenAt || new Date(row.clientUpdatedAt) > new Date(curr.lastSeenAt)) {
          curr.lastSeenAt = row.clientUpdatedAt;
        }
        byModuleMap.set(key, curr);
      }
    }

    const byModule = Array.from(byModuleMap.values()).map((m) => ({
      module: m.module,
      pending: m.pending,
      retryFailures: m.retryFailures,
      clients: m._clientSet.size,
      lastSeenAt: m.lastSeenAt,
    }));

    const clients = filtered.map((row) => ({
      id: row._id,
      userName: row?.user?.name || null,
      userEmail: row?.user?.email || null,
      hospitalName: row?.hospital?.name || null,
      role: row.role || null,
      online: row.online !== false,
      queueLength: Number(row.queueLength || 0),
      queuedTotal: Number(row.queuedTotal || 0),
      syncedTotal: Number(row.syncedTotal || 0),
      failedTotal: Number(row.failedTotal || 0),
      lastSyncAt: row.lastSyncAt || null,
      lastEnqueueAt: row.lastEnqueueAt || null,
      clientUpdatedAt: row.clientUpdatedAt || null,
      deviceId: row.deviceId || null,
      modules: row.modules || [],
    }));

    res.json({
      ok: true,
      summary: {
        clients: clients.length,
        pendingQueued,
        retryFailures,
        lastSyncAt,
      },
      byModule: byModule.sort((a, b) => b.pending - a.pending),
      clients,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || "Failed to load metrics" });
  }
});

export default router;
