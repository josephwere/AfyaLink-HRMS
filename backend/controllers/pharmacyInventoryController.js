import PharmacyItem from "../models/PharmacyItem.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import PharmacyReservation from "../models/PharmacyReservation.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { notifyRolesInHospital } from "../services/notificationService.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import PharmacyBatchControl from "../models/PharmacyBatchControl.js";

function resolveHospital(req) {
  const role = normalizeRole(req.user?.role || "");
  if (
    req.query?.hospitalId &&
    ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)
  ) {
    return req.query.hospitalId;
  }
  return req.user?.hospital || req.user?.hospitalId || null;
}

function ensureHospital(req, res) {
  const hospital = resolveHospital(req);
  if (!hospital) {
    res.status(400).json({ msg: "Hospital scope required" });
    return null;
  }
  return hospital;
}

export const listItems = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const q = (req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const filter = { hospital };
    if (q) filter.name = { $regex: q, $options: "i" };

    const [items, total] = await Promise.all([
      PharmacyItem.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PharmacyItem.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error("Pharmacy list error:", err);
    res.status(500).json({ msg: "Failed to load pharmacy items" });
  }
};

export const listAvailableMedicines = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const q = String(req.query.q || "").trim();
    const includeOutOfStock = String(req.query.includeOutOfStock || "").toLowerCase() === "true";
    const limit = Math.min(Math.max(parseInt(req.query.limit || "200", 10), 1), 500);
    const filter = {
      hospital,
      active: { $ne: false },
    };

    if (!includeOutOfStock) {
      filter.totalQuantity = { $gt: 0 };
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const items = await PharmacyItem.find(filter)
      .select("name sku description category form strength unit totalQuantity minStock batches updatedAt")
      .sort({ totalQuantity: -1, name: 1 })
      .limit(limit)
      .lean();

    res.json({
      items: items.map((item) => {
        const totalQuantity = Number(item.totalQuantity || 0);
        const minStock = Number(item.minStock || 0);
        const stockStatus =
          totalQuantity <= 0
            ? "OUT_OF_STOCK"
            : minStock > 0 && totalQuantity <= minStock
              ? "LOW_STOCK"
              : "AVAILABLE";
        return {
          _id: item._id,
          name: item.name,
          sku: item.sku || "",
          description: item.description || "",
          category: item.category || "medicine",
          form: item.form || "",
          strength: item.strength || "",
          unit: item.unit || "pcs",
          totalQuantity,
          minStock,
          stockStatus,
          batchCount: Array.isArray(item.batches) ? item.batches.length : 0,
          updatedAt: item.updatedAt,
        };
      }),
      total: items.length,
    });
  } catch (err) {
    console.error("Available medicines error:", err);
    res.status(500).json({ msg: "Failed to load available medicines" });
  }
};

export const getItem = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const item = await PharmacyItem.findOne({
      _id: req.params.id,
      hospital,
    }).lean();

    if (!item) return res.status(404).json({ msg: "Item not found" });
    res.json(item);
  } catch (err) {
    console.error("Pharmacy get error:", err);
    res.status(500).json({ msg: "Failed to load item" });
  }
};

export const createItem = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const {
      name,
      genericName,
      therapeuticClass,
      sku,
      description,
      unit,
      minStock,
      storageLocation,
      controlledDrug,
      batches,
    } = req.body || {};
    if (!name) return res.status(400).json({ msg: "Name is required" });

    const normalizedBatches = Array.isArray(batches)
      ? batches.map((batch) => ({
          batchNumber: batch?.batchNumber || "",
          expiryDate: batch?.expiryDate || null,
          quantity: Number(batch?.quantity) || 0,
          costPrice: Number(batch?.costPrice) || 0,
          sellingPrice: Number(batch?.sellingPrice) || 0,
        }))
      : [];

    const totalQuantity = normalizedBatches.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);

    const item = await PharmacyItem.create({
      hospital,
      name,
      genericName: genericName || "",
      therapeuticClass: therapeuticClass || "",
      sku,
      description,
      unit,
      storageLocation: storageLocation || "",
      controlledDrug: Boolean(controlledDrug),
      minStock: Number(minStock) || 0,
      batches: normalizedBatches,
      totalQuantity,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    if (normalizedBatches.length) {
      await PharmacyInventoryMovement.insertMany(
        normalizedBatches.map((batch) => ({
          itemId: item._id,
          hospital,
          movementType: "RECEIPT",
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : null,
          quantity: Number(batch.quantity) || 0,
          previousQuantity: 0,
          newQuantity: Number(batch.quantity) || 0,
          referenceType: "INITIAL_STOCK",
          note: "Initial stock entry",
          performedBy: req.user?._id,
        }))
      );
    }

    res.status(201).json(item);
  } catch (err) {
    console.error("Pharmacy create error:", err);
    res.status(500).json({ msg: "Failed to create item" });
  }
};

export const updateItem = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const item = await PharmacyItem.findOne({
      _id: req.params.id,
      hospital,
    });
    if (!item) return res.status(404).json({ msg: "Item not found" });

    const { name, sku, description, unit, minStock } = req.body || {};
    if (name !== undefined) item.name = name;
    if (sku !== undefined) item.sku = sku;
    if (description !== undefined) item.description = description;
    if (unit !== undefined) item.unit = unit;
    if (minStock !== undefined) item.minStock = Number(minStock) || 0;
    item.updatedBy = req.user?._id;

    await item.save();
    res.json(item);
  } catch (err) {
    console.error("Pharmacy update error:", err);
    res.status(500).json({ msg: "Failed to update item" });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const item = await PharmacyItem.findOneAndDelete({
      _id: req.params.id,
      hospital,
    });
    if (!item) return res.status(404).json({ msg: "Item not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Pharmacy delete error:", err);
    res.status(500).json({ msg: "Failed to delete item" });
  }
};

export const addStock = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const { quantity, batchNumber, expiryDate, costPrice, sellingPrice, note } =
      req.body || {};
    const qty = Number(quantity) || 0;
    if (qty <= 0) return res.status(400).json({ msg: "Quantity must be > 0" });

    const item = await PharmacyItem.findOne({
      _id: req.params.id,
      hospital,
    });
    if (!item) return res.status(404).json({ msg: "Item not found" });

    const previousQuantity = Number(item.totalQuantity || 0);
    const existingBatch =
      batchNumber &&
      item.batches.find((b) => b.batchNumber === String(batchNumber));

    if (existingBatch) {
      existingBatch.quantity += qty;
      if (expiryDate) existingBatch.expiryDate = expiryDate;
      if (costPrice !== undefined) existingBatch.costPrice = Number(costPrice) || 0;
      if (sellingPrice !== undefined)
        existingBatch.sellingPrice = Number(sellingPrice) || 0;
    } else {
      item.batches.push({
        batchNumber,
        expiryDate,
        quantity: qty,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
      });
    }

    item.totalQuantity += qty;
    item.updatedBy = req.user?._id;
    await item.save();

    await PharmacyInventoryMovement.create({
      itemId: item._id,
      hospital,
      movementType: "RECEIPT",
      batchNumber: batchNumber || "",
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      quantity: qty,
      previousQuantity,
      newQuantity: Number(item.totalQuantity || 0),
      referenceType: "STOCK_RECEIPT",
      note: note || "Stock added",
      performedBy: req.user?._id,
    });

    res.json(item);
  } catch (err) {
    console.error("Pharmacy add stock error:", err);
    res.status(500).json({ msg: "Failed to add stock" });
  }
};

export const reserveStock = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const { quantity, batchNumber, prescriptionId, note } = req.body || {};
    const qty = Number(quantity) || 0;
    if (qty <= 0) return res.status(400).json({ msg: "Quantity must be > 0" });

    const item = await PharmacyItem.findOne({ _id: req.params.id, hospital });
    if (!item) return res.status(404).json({ msg: "Item not found" });

    const batch = batchNumber
      ? item.batches.find((entry) => entry.batchNumber === String(batchNumber))
      : item.batches.sort((a, b) => new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0))[0];

    if (!batch) return res.status(400).json({ msg: "No stock batch available" });
    if (batch.quantity < qty) return res.status(400).json({ msg: "Insufficient batch stock" });
    const held = await PharmacyBatchControl.exists({ hospital, itemId: item._id, batchNumber: batch.batchNumber, status: { $in: ["QUARANTINED", "RECALLED"] } });
    if (held) return res.status(409).json({ msg: "Batch is under regulatory hold" });

    const reservation = await PharmacyReservation.create({
      hospital,
      itemId: item._id,
      prescriptionId: prescriptionId || null,
      batchNumber: batch.batchNumber,
      quantity: qty,
      status: "ACTIVE",
      reservedBy: req.user?._id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      note: note || "Reserved for dispensing",
    });

    res.status(201).json(reservation);
  } catch (err) {
    console.error("Pharmacy reserve error:", err);
    res.status(500).json({ msg: "Failed to reserve stock" });
  }
};

export const dispenseStock = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const { reservationId, quantity, note } = req.body || {};
    const qty = Number(quantity) || 0;
    if (qty <= 0) return res.status(400).json({ msg: "Quantity must be > 0" });

    const reservation = await PharmacyReservation.findOne({ _id: reservationId, hospital, status: "ACTIVE" });
    if (!reservation) return res.status(404).json({ msg: "Reservation not found" });
    if (reservation.quantity < qty) return res.status(400).json({ msg: "Reservation quantity exceeded" });

    const item = await PharmacyItem.findOne({ _id: reservation.itemId, hospital });
    if (!item) return res.status(404).json({ msg: "Item not found" });

    const previousQuantity = Number(item.totalQuantity || 0);
    const batch = item.batches.find((entry) => entry.batchNumber === String(reservation.batchNumber));
    if (!batch) return res.status(400).json({ msg: "Batch not found" });
    if (batch.quantity < qty) return res.status(400).json({ msg: "Insufficient batch stock" });
    const held = await PharmacyBatchControl.exists({ hospital, itemId: item._id, batchNumber: batch.batchNumber, status: { $in: ["QUARANTINED", "RECALLED"] } });
    if (held) return res.status(409).json({ msg: "Batch is under regulatory hold" });

    batch.quantity -= qty;
    item.totalQuantity -= qty;
    item.updatedBy = req.user?._id;
    await item.save();

    reservation.quantity -= qty;
    reservation.status = reservation.quantity === 0 ? "FULFILLED" : "ACTIVE";
    reservation.fulfilledBy = req.user?._id;
    await reservation.save();

    await PharmacyInventoryMovement.create({
      itemId: item._id,
      hospital,
      movementType: "DISPENSE",
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate || null,
      quantity: qty,
      previousQuantity,
      newQuantity: Number(item.totalQuantity || 0),
      referenceType: "DISPENSE",
      note: note || "Medication dispensed",
      performedBy: req.user?._id,
    });

    // If stock has reached or fallen below the configured minimum, notify hospital admins and pharmacists
    try {
      const minStock = Number(item.minStock || 0);
      if (minStock > 0 && Number(item.totalQuantity || 0) <= minStock) {
        const title = `⚠ ${item.name} running low`;
        const body = `${item.name} has ${Number(item.totalQuantity || 0)} remaining. Minimum: ${minStock}`;
        const meta = { type: "PHARMACY_LOW_STOCK", itemId: item._id, path: "/pharmacy/inventory" };

        // Use role-targeted helper to notify pharmacists and admins
        await notifyRolesInHospital({ hospital, roles: ["PHARMACIST"], title, body, category: "PHARMACY", meta });
        await notifyRolesInHospital({ hospital, roles: ["HOSPITAL_ADMIN"], title: `Inventory running low: ${item.name}`, body: `${item.name} has ${Number(item.totalQuantity || 0)} remaining (min ${minStock}).`, category: "OPERATIONAL", meta });
      }
    } catch (notifyErr) {
      // Non-fatal: log and continue
      console.error("Low stock notification error:", notifyErr);
    }

    res.json({ item, reservation });
  } catch (err) {
    console.error("Pharmacy dispense error:", err);
    res.status(500).json({ msg: "Failed to dispense stock" });
  }
};
