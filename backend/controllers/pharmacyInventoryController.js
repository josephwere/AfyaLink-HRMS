import PharmacyItem from "../models/PharmacyItem.js";
import { normalizeRole } from "../utils/normalizeRole.js";

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

    const { name, sku, description, unit, minStock, batches } = req.body || {};
    if (!name) return res.status(400).json({ msg: "Name is required" });

    const totalQuantity = Array.isArray(batches)
      ? batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
      : 0;

    const item = await PharmacyItem.create({
      hospital,
      name,
      sku,
      description,
      unit,
      minStock: Number(minStock) || 0,
      batches: Array.isArray(batches) ? batches : [],
      totalQuantity,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

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

    const { quantity, batchNumber, expiryDate, costPrice, sellingPrice } =
      req.body || {};
    const qty = Number(quantity) || 0;
    if (qty <= 0) return res.status(400).json({ msg: "Quantity must be > 0" });

    const item = await PharmacyItem.findOne({
      _id: req.params.id,
      hospital,
    });
    if (!item) return res.status(404).json({ msg: "Item not found" });

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

    res.json(item);
  } catch (err) {
    console.error("Pharmacy add stock error:", err);
    res.status(500).json({ msg: "Failed to add stock" });
  }
};

export const dispenseStock = async (req, res) => {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;

    const { quantity, batchNumber } = req.body || {};
    const qty = Number(quantity) || 0;
    if (qty <= 0) return res.status(400).json({ msg: "Quantity must be > 0" });

    const item = await PharmacyItem.findOne({
      _id: req.params.id,
      hospital,
    });
    if (!item) return res.status(404).json({ msg: "Item not found" });
    if (item.totalQuantity < qty) {
      return res.status(400).json({ msg: "Insufficient stock" });
    }

    if (batchNumber) {
      const batch = item.batches.find((b) => b.batchNumber === String(batchNumber));
      if (!batch) return res.status(400).json({ msg: "Batch not found" });
      if (batch.quantity < qty) {
        return res.status(400).json({ msg: "Insufficient batch stock" });
      }
      batch.quantity -= qty;
    }

    item.totalQuantity -= qty;
    item.updatedBy = req.user?._id;
    await item.save();

    res.json(item);
  } catch (err) {
    console.error("Pharmacy dispense error:", err);
    res.status(500).json({ msg: "Failed to dispense stock" });
  }
};
