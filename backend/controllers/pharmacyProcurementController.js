import PharmacyItem from "../models/PharmacyItem.js";
import PharmacySupplier from "../models/PharmacySupplier.js";
import PharmacyPurchaseOrder from "../models/PharmacyPurchaseOrder.js";
import PharmacyInventoryMovement from "../models/PharmacyInventoryMovement.js";
import HospitalSupplierRelationship from "../models/HospitalSupplierRelationship.js";
import PharmacySupplierProduct from "../models/PharmacySupplierProduct.js";
import PharmacyRFQ from "../models/PharmacyRFQ.js";
import PharmacyQuotation from "../models/PharmacyQuotation.js";
import PharmacySupplierInvoice from "../models/PharmacySupplierInvoice.js";
import PharmacySupplierPayment from "../models/PharmacySupplierPayment.js";
import PharmacyShipment from "../models/PharmacyShipment.js";
import PharmacyGoodsReceipt from "../models/PharmacyGoodsReceipt.js";
import PharmacyBatchControl from "../models/PharmacyBatchControl.js";
import User from "../models/User.js";
import { notifyRolesInHospital, notifyUsers } from "../services/notificationService.js";
import { emitOperationalEvent } from "../services/operationalEventGateway.js";
import { verifyIncomingBatch } from "./pharmacyTraceabilityController.js";
import { normalizeRole } from "../utils/normalizeRole.js";

const HOSPITAL_ROLES = ["PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"];

function hospitalFor(req) {
  const role = normalizeRole(req.user?.role);
  if (req.query?.hospitalId && ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(role)) return req.query.hospitalId;
  return req.user?.hospital || req.user?.hospitalId || null;
}

function supplierUser(req) {
  return normalizeRole(req.user?.role) === "SUPPLIER";
}

function ensureHospital(req, res) {
  const hospital = hospitalFor(req);
  if (!hospital) {
    res.status(400).json({ msg: "Hospital scope required" });
    return null;
  }
  return hospital;
}

export async function listSuppliers(req, res) {
  try {
    const filter = supplierUser(req)
      ? { _id: req.user?.supplier, active: true }
      : { active: true };
    if (!filter._id && !supplierUser(req)) {
      const hospital = ensureHospital(req, res);
      if (!hospital) return;
      const approved = await HospitalSupplierRelationship.find({ hospital, status: "APPROVED" }).select("supplier").lean();
      filter._id = { $in: approved.map((relationship) => relationship.supplier) };
    }
    if (!filter._id) return res.json({ suppliers: [] });
    const suppliers = await PharmacySupplier.find(filter).sort({ name: 1 }).lean();
    res.json({ suppliers });
  } catch (err) {
    console.error("Supplier list error:", err);
    res.status(500).json({ msg: "Failed to load suppliers" });
  }
}

export async function createSupplier(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const { name, legalName, contactName, email, phone, userIds = [] } = req.body || {};
    if (!String(name || "").trim()) return res.status(400).json({ msg: "Supplier name is required" });
    const supplier = await PharmacySupplier.create({
      name, legalName, contactName, email, phone,
      hospitals: [hospital], users: Array.isArray(userIds) ? userIds : [], createdBy: req.user?._id,
    });
    if (Array.isArray(userIds) && userIds.length) {
      await User.updateMany({ _id: { $in: userIds } }, { $set: { supplier: supplier._id, role: "SUPPLIER" } });
    }
    res.status(201).json(supplier);
  } catch (err) {
    console.error("Supplier create error:", err);
    res.status(500).json({ msg: "Failed to create supplier" });
  }
}

export async function listPurchaseOrders(req, res) {
  try {
    const filter = supplierUser(req)
      ? { supplier: req.user?.supplier }
      : { hospital: ensureHospital(req, res) };
    if (!filter.hospital && !filter.supplier) return;
    const orders = await PharmacyPurchaseOrder.find(filter)
      .populate("supplier", "name email phone")
      .populate("hospital", "name code")
      .sort({ createdAt: -1 }).limit(100).lean();
    res.json({ orders });
  } catch (err) {
    console.error("Purchase order list error:", err);
    res.status(500).json({ msg: "Failed to load purchase orders" });
  }
}

export async function createPurchaseOrder(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const { supplierId, items = [], expectedDeliveryAt } = req.body || {};
    if (!supplierId || !Array.isArray(items) || !items.length) return res.status(400).json({ msg: "Supplier and at least one item are required" });
    const supplier = await PharmacySupplier.findOne({ _id: supplierId, active: true, regulatoryStatus: "ACTIVE" }).lean();
    if (!supplier) return res.status(404).json({ msg: "Supplier is not linked to this hospital" });
    const relationship = await HospitalSupplierRelationship.findOne({ hospital, supplier: supplier._id, status: "APPROVED" }).lean();
    if (!relationship) return res.status(403).json({ msg: "Supplier relationship is not approved" });
    const itemIds = items.map((line) => line?.itemId).filter(Boolean);
    const catalog = await PharmacyItem.find({ _id: { $in: itemIds }, hospital }).select("name").lean();
    const catalogById = new Map(catalog.map((item) => [String(item._id), item]));
    const lines = items.map((line) => ({
      itemId: line.itemId,
      name: catalogById.get(String(line.itemId))?.name || String(line.name || "Item"),
      quantity: Number(line.quantity), unitCost: Number(line.unitCost),
    }));
    if (lines.some((line) => !catalogById.has(String(line.itemId)) || line.quantity <= 0 || line.unitCost < 0)) return res.status(400).json({ msg: "Purchase order items are invalid" });
    const totalAmount = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const order = await PharmacyPurchaseOrder.create({ hospital, supplier: supplier._id, items: lines, expectedDeliveryAt, totalAmount, createdBy: req.user?._id });
    await notifyRolesInHospital({ hospital, roles: ["PHARMACIST", "HOSPITAL_ADMIN"], title: "Supplier purchase order submitted", body: `${supplier.name} order ${order._id} is awaiting fulfilment.`, category: "PROCUREMENT", meta: { type: "PHARMACY_PURCHASE_ORDER", orderId: order._id } });
    await notifyUsers({ users: supplier.users, hospital, title: "New hospital purchase order", body: `Purchase order ${order._id} is ready for acknowledgement.`, category: "PROCUREMENT", meta: { type: "PHARMACY_PURCHASE_ORDER", orderId: order._id } });
    res.status(201).json(order);
  } catch (err) {
    console.error("Purchase order create error:", err);
    res.status(500).json({ msg: "Failed to create purchase order" });
  }
}

export async function updatePurchaseOrder(req, res) {
  try {
    const order = await PharmacyPurchaseOrder.findOne(supplierUser(req) ? { _id: req.params.id, supplier: req.user?.supplier } : { _id: req.params.id, hospital: hospitalFor(req) });
    if (!order) return res.status(404).json({ msg: "Purchase order not found" });
    const nextStatus = String(req.body?.status || order.status).toUpperCase();
    const nextPayment = String(req.body?.paymentStatus || order.paymentStatus).toUpperCase();
    if (!["DRAFT", "SUBMITTED", "ACKNOWLEDGED", "SHIPPED", "RECEIVED", "CANCELLED"].includes(nextStatus) || !["PENDING", "PAID", "FAILED"].includes(nextPayment)) return res.status(400).json({ msg: "Invalid purchase order state" });
    const transitions = {
      DRAFT: ["DRAFT", "SUBMITTED", "CANCELLED"],
      SUBMITTED: ["SUBMITTED", "ACKNOWLEDGED", "CANCELLED"],
      ACKNOWLEDGED: ["ACKNOWLEDGED", "SHIPPED", "CANCELLED"],
      SHIPPED: ["SHIPPED", "RECEIVED"],
      RECEIVED: ["RECEIVED"],
      CANCELLED: ["CANCELLED"],
    };
    if (!transitions[order.status]?.includes(nextStatus)) return res.status(409).json({ msg: `Cannot move purchase order from ${order.status} to ${nextStatus}` });
    if (supplierUser(req) && nextPayment !== order.paymentStatus) return res.status(403).json({ msg: "Suppliers cannot change payment state" });
    order.status = nextStatus;
    order.paymentStatus = nextPayment;
    if (req.body?.paymentReference !== undefined) order.paymentReference = String(req.body.paymentReference || "");
    order.updatedBy = req.user?._id;
    await order.save();
    if (nextPayment === "PAID") {
      const supplier = await PharmacySupplier.findById(order.supplier).select("users name").lean();
      const meta = { type: "SUPPLIER_PAYMENT_CONFIRMED", orderId: order._id };
      await notifyRolesInHospital({ hospital: order.hospital, roles: HOSPITAL_ROLES, title: "Supplier payment confirmed", body: `Payment for purchase order ${order._id} is confirmed.`, category: "PAYMENT", meta });
      await notifyUsers({ users: supplier?.users || [], hospital: order.hospital, title: "Hospital payment confirmed", body: `Payment for order ${order._id} from ${supplier?.name || "the hospital"} is confirmed.`, category: "PAYMENT", meta });
    }
    res.json(order);
  } catch (err) {
    console.error("Purchase order update error:", err);
    res.status(500).json({ msg: "Failed to update purchase order" });
  }
}

export async function listStockRisks(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [items, movements] = await Promise.all([
      PharmacyItem.find({ hospital, active: { $ne: false }, totalQuantity: { $gt: 0 } }).select("name sku unit totalQuantity minStock").lean(),
      PharmacyInventoryMovement.find({ hospital, movementType: "DISPENSE", createdAt: { $gte: since } }).select("itemId quantity").lean(),
    ]);
    const usage = movements.reduce((map, movement) => { map[String(movement.itemId)] = (map[String(movement.itemId)] || 0) + Number(movement.quantity || 0); return map; }, {});
    const risks = items.map((item) => {
      const averageDailyUse = (usage[String(item._id)] || 0) / 30;
      const estimatedDaysUntilStockout = averageDailyUse > 0 ? Math.floor(Number(item.totalQuantity) / averageDailyUse) : null;
      return { ...item, averageDailyUse: Number(averageDailyUse.toFixed(2)), estimatedDaysUntilStockout, risk: estimatedDaysUntilStockout !== null && estimatedDaysUntilStockout <= 14 ? "HIGH" : Number(item.totalQuantity) <= Number(item.minStock || 0) ? "MEDIUM" : "LOW" };
    }).filter((item) => item.risk !== "LOW").sort((a, b) => (a.estimatedDaysUntilStockout ?? 9999) - (b.estimatedDaysUntilStockout ?? 9999));
    res.json({ risks, generatedAt: new Date().toISOString(), horizonDays: 30 });
  } catch (err) {
    console.error("Stock risk error:", err);
    res.status(500).json({ msg: "Failed to calculate stock risks" });
  }
}

export async function listSupplierRelationships(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const relationships = await HospitalSupplierRelationship.find({ hospital }).populate("supplier", "name email phone").sort({ preferred: -1, createdAt: -1 }).lean();
    res.json({ relationships });
  } catch (err) {
    console.error("Supplier relationship list error:", err);
    res.status(500).json({ msg: "Failed to load supplier relationships" });
  }
}

export async function createSupplierRelationship(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const supplier = await PharmacySupplier.findOne({ _id: req.body?.supplierId, active: true }).lean();
    if (!supplier) return res.status(404).json({ msg: "Supplier not found" });
    const relationship = await HospitalSupplierRelationship.findOneAndUpdate(
      { hospital, supplier: supplier._id },
      { $set: { status: "PENDING", paymentTerms: req.body?.paymentTerms || "", deliveryTerms: req.body?.deliveryTerms || "" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await notifyUsers({ users: supplier.users, hospital, title: "Hospital supplier relationship requested", body: "A hospital has requested to work with your organization.", category: "PROCUREMENT", meta: { type: "SUPPLIER_RELATIONSHIP_REQUEST", relationshipId: relationship._id } });
    res.status(201).json(relationship);
  } catch (err) {
    console.error("Supplier relationship create error:", err);
    res.status(500).json({ msg: "Failed to request supplier relationship" });
  }
}

export async function updateSupplierRelationship(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const status = String(req.body?.status || "").toUpperCase();
    if (!["PENDING", "APPROVED", "SUSPENDED", "BLOCKED", "TERMINATED"].includes(status)) return res.status(400).json({ msg: "Invalid relationship status" });
    const relationship = await HospitalSupplierRelationship.findOneAndUpdate(
      { _id: req.params.id, hospital },
      { $set: { status, approvedAt: status === "APPROVED" ? new Date() : null, approvedBy: status === "APPROVED" ? req.user?._id : null } },
      { new: true }
    );
    if (!relationship) return res.status(404).json({ msg: "Supplier relationship not found" });
    res.json(relationship);
  } catch (err) {
    console.error("Supplier relationship update error:", err);
    res.status(500).json({ msg: "Failed to update supplier relationship" });
  }
}

export async function listSupplierProducts(req, res) {
  try {
    const filter = supplierUser(req) ? { supplier: req.user?.supplier } : { supplier: req.query?.supplierId };
    if (!filter.supplier) return res.status(400).json({ msg: "Supplier scope required" });
    if (!supplierUser(req)) {
      const hospital = ensureHospital(req, res);
      if (!hospital) return;
      const approved = await HospitalSupplierRelationship.exists({ hospital, supplier: filter.supplier, status: "APPROVED" });
      if (!approved) return res.status(403).json({ msg: "Supplier relationship is not approved" });
    }
    const products = await PharmacySupplierProduct.find({ ...filter, active: true }).sort({ name: 1 }).lean();
    res.json({ products });
  } catch (err) {
    console.error("Supplier product list error:", err);
    res.status(500).json({ msg: "Failed to load supplier products" });
  }
}

export async function upsertSupplierProduct(req, res) {
  try {
    if (!supplierUser(req)) return res.status(403).json({ msg: "Supplier account required" });
    const { name, genericName, sku, unit, unitPrice, minimumOrderQuantity, deliveryAreas, batches } = req.body || {};
    if (!String(name || "").trim()) return res.status(400).json({ msg: "Product name is required" });
    const product = await PharmacySupplierProduct.findOneAndUpdate(
      { _id: req.params.id || null, supplier: req.user?.supplier },
      { $set: { name, genericName, sku, unit, unitPrice: Number(unitPrice) || 0, minimumOrderQuantity: Number(minimumOrderQuantity) || 1, deliveryAreas: Array.isArray(deliveryAreas) ? deliveryAreas : [], batches: Array.isArray(batches) ? batches : [] } },
      { new: true, upsert: !req.params.id, setDefaultsOnInsert: true }
    );
    res.status(req.params.id ? 200 : 201).json(product);
  } catch (err) {
    console.error("Supplier product save error:", err);
    res.status(500).json({ msg: "Failed to save supplier product" });
  }
}

function scopedRfqFilter(req) {
  return supplierUser(req) ? { suppliers: req.user?.supplier } : { hospital: hospitalFor(req) };
}

export async function listRfqs(req, res) {
  try {
    const filter = scopedRfqFilter(req);
    if (!filter.hospital && !filter.suppliers) return res.status(400).json({ msg: "Procurement scope required" });
    const rfqs = await PharmacyRFQ.find(filter).populate("hospital", "name code").sort({ createdAt: -1 }).lean();
    res.json({ rfqs });
  } catch (err) {
    console.error("RFQ list error:", err);
    res.status(500).json({ msg: "Failed to load RFQs" });
  }
}

export async function createRfq(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const supplierIds = Array.isArray(req.body?.supplierIds) ? req.body.supplierIds : [];
    if (!items.length || !supplierIds.length) return res.status(400).json({ msg: "Items and eligible suppliers are required" });
    const relationships = await HospitalSupplierRelationship.find({ hospital, supplier: { $in: supplierIds }, status: "APPROVED" }).select("supplier").lean();
    const approvedSupplierIds = relationships.map((relationship) => relationship.supplier);
    if (!approvedSupplierIds.length) return res.status(400).json({ msg: "No approved supplier relationship selected" });
    const catalog = await PharmacyItem.find({ _id: { $in: items.map((item) => item.itemId) }, hospital }).select("name").lean();
    const names = new Map(catalog.map((item) => [String(item._id), item.name]));
    const normalizedItems = items.map((item) => ({ itemId: item.itemId, name: names.get(String(item.itemId)) || item.name, quantity: Number(item.quantity) }));
    if (normalizedItems.some((item) => !names.has(String(item.itemId)) || item.quantity <= 0)) return res.status(400).json({ msg: "RFQ items are invalid" });
    const rfq = await PharmacyRFQ.create({ hospital, items: normalizedItems, suppliers: approvedSupplierIds, status: "SENT", responseDueAt: req.body?.responseDueAt, createdBy: req.user?._id });
    const supplierUsers = await User.find({ supplier: { $in: approvedSupplierIds }, active: true }).select("_id").lean();
    await notifyUsers({ users: supplierUsers, hospital, title: "New procurement opportunity", body: `RFQ ${rfq._id} is ready for quotation.`, category: "PROCUREMENT", meta: { type: "PHARMACY_RFQ", rfqId: rfq._id } });
    res.status(201).json(rfq);
  } catch (err) {
    console.error("RFQ create error:", err);
    res.status(500).json({ msg: "Failed to create RFQ" });
  }
}

export async function listQuotations(req, res) {
  try {
    const filter = supplierUser(req) ? { supplier: req.user?.supplier } : { hospital: hospitalFor(req) };
    if (!filter.hospital && !filter.supplier) return res.status(400).json({ msg: "Procurement scope required" });
    const quotations = await PharmacyQuotation.find(filter).populate("supplier", "name").sort({ createdAt: -1 }).lean();
    res.json({ quotations });
  } catch (err) {
    console.error("Quotation list error:", err);
    res.status(500).json({ msg: "Failed to load quotations" });
  }
}

export async function createQuotation(req, res) {
  try {
    if (!supplierUser(req)) return res.status(403).json({ msg: "Supplier account required" });
    const rfq = await PharmacyRFQ.findOne({ _id: req.body?.rfqId, suppliers: req.user?.supplier, status: "SENT" }).lean();
    if (!rfq) return res.status(404).json({ msg: "RFQ not found or no longer open" });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const rfqItems = new Map(rfq.items.map((item) => [String(item.itemId), item.quantity]));
    if (!items.length || items.some((item) => !rfqItems.has(String(item.itemId)) || Number(item.quantity) <= 0 || Number(item.quantity) > rfqItems.get(String(item.itemId)))) return res.status(400).json({ msg: "Quotation items are invalid" });
    const normalizedItems = items.map((item) => ({ itemId: item.itemId, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), discount: Number(item.discount) || 0 }));
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
    const deliveryFee = Number(req.body?.deliveryFee) || 0;
    const tax = Number(req.body?.tax) || 0;
    const quotation = await PharmacyQuotation.create({ rfq: rfq._id, hospital: rfq.hospital, supplier: req.user.supplier, items: normalizedItems, leadTimeDays: Number(req.body?.leadTimeDays) || 0, deliveryFee, tax, paymentTerms: req.body?.paymentTerms || "", expectedDeliveryAt: req.body?.expectedDeliveryAt, totalAmount: subtotal + deliveryFee + tax, createdBy: req.user?._id });
    await PharmacyRFQ.updateOne({ _id: rfq._id }, { $set: { status: "QUOTED" } });
    res.status(201).json(quotation);
  } catch (err) {
    console.error("Quotation create error:", err);
    res.status(500).json({ msg: "Failed to submit quotation" });
  }
}

export async function awardQuotation(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const quotation = await PharmacyQuotation.findOne({ _id: req.params.id, hospital, status: { $in: ["SUBMITTED", "SHORTLISTED"] } }).populate("supplier", "name users").lean();
    if (!quotation) return res.status(404).json({ msg: "Quotation not found or already awarded" });
    const relationship = await HospitalSupplierRelationship.exists({ hospital, supplier: quotation.supplier._id, status: "APPROVED" });
    if (!relationship) return res.status(403).json({ msg: "Supplier relationship is not approved" });
    const catalog = await PharmacyItem.find({ _id: { $in: quotation.items.map((item) => item.itemId) }, hospital }).select("name").lean();
    const catalogById = new Map(catalog.map((item) => [String(item._id), item.name]));
    const order = await PharmacyPurchaseOrder.create({
      hospital,
      supplier: quotation.supplier._id,
      items: quotation.items.map((item) => ({ itemId: item.itemId, name: catalogById.get(String(item.itemId)) || "Medication", quantity: item.quantity, unitCost: item.unitPrice })),
      expectedDeliveryAt: quotation.expectedDeliveryAt,
      totalAmount: quotation.totalAmount,
      createdBy: req.user?._id,
    });
    await PharmacyQuotation.updateOne({ _id: quotation._id }, { $set: { status: "ACCEPTED" } });
    await PharmacyRFQ.updateOne({ _id: quotation.rfq }, { $set: { status: "AWARDED" } });
    const meta = { type: "PHARMACY_QUOTATION_AWARDED", quotationId: quotation._id, orderId: order._id };
    await notifyUsers({ users: quotation.supplier.users, hospital, title: "Quotation approved", body: `Purchase order ${order._id} has been created from your quotation.`, category: "PROCUREMENT", meta });
    res.status(201).json(order);
  } catch (err) {
    console.error("Quotation award error:", err);
    res.status(500).json({ msg: "Failed to award quotation" });
  }
}

export async function createShipment(req, res) {
  try {
    if (!supplierUser(req)) return res.status(403).json({ msg: "Supplier account required" });
    const order = await PharmacyPurchaseOrder.findOne({ _id: req.body?.purchaseOrderId, supplier: req.user?.supplier, status: { $in: ["ACKNOWLEDGED", "SHIPPED"] } }).lean();
    if (!order) return res.status(404).json({ msg: "Purchase order is not ready for shipment" });
    const shipment = await PharmacyShipment.findOneAndUpdate(
      { purchaseOrder: order._id },
      { $set: { hospital: order.hospital, supplier: order.supplier, status: String(req.body?.status || "DISPATCHED").toUpperCase(), trackingNumber: req.body?.trackingNumber || "", deliveryProofUrl: req.body?.deliveryProofUrl || "", items: Array.isArray(req.body?.items) ? req.body.items : [], dispatchedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    await PharmacyPurchaseOrder.updateOne({ _id: order._id }, { $set: { status: "SHIPPED" } });
    await emitOperationalEvent({ type: "PHARMACY_SHIPMENT_DISPATCHED", hospitalId: order.hospital, source: "pharmacy.procurement", actor: req.user?._id, payload: { resourceId: shipment._id, purchaseOrderId: order._id, notification: { title: "Supplier shipment dispatched", body: `Purchase order ${order._id} has been dispatched.`, category: "PROCUREMENT", meta: { shipmentId: shipment._id } } } });
    res.status(201).json(shipment);
  } catch (err) {
    console.error("Shipment create error:", err);
    res.status(500).json({ msg: "Failed to create shipment" });
  }
}

export async function receivePurchaseOrder(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const order = await PharmacyPurchaseOrder.findOne({ _id: req.params.id, hospital, status: { $in: ["SHIPPED", "RECEIVED"] } }).lean();
    if (!order) return res.status(404).json({ msg: "Purchase order is not ready for receiving" });
    if (await PharmacyGoodsReceipt.exists({ purchaseOrder: order._id })) return res.status(409).json({ msg: "Purchase order has already been received" });
    const receivedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const orderItems = new Map(order.items.map((item) => [String(item.itemId), item]));
    if (!receivedItems.length || receivedItems.some((item) => !orderItems.has(String(item.itemId)) || Number(item.receivedQuantity) < 0 || Number(item.receivedQuantity) > orderItems.get(String(item.itemId)).quantity)) return res.status(400).json({ msg: "Receipt quantities are invalid" });
    const normalizedReceivedItems = receivedItems.map((received) => ({
      ...received,
      expectedQuantity: orderItems.get(String(received.itemId)).quantity,
      receivedQuantity: Number(received.receivedQuantity) || 0,
      damagedQuantity: Number(received.damagedQuantity) || 0,
      rejectedQuantity: Number(received.rejectedQuantity) || 0,
    }));
    const verifications = await Promise.all(normalizedReceivedItems.map((received) => verifyIncomingBatch({ hospital, itemId: received.itemId, batchNumber: received.batchNumber, supplierId: order.supplier, purchaseOrderId: order._id, registrationNumber: received.registrationNumber, manufacturer: received.manufacturer, expiryDate: received.expiryDate, scannedCode: received.scannedCode, scannedBy: req.user?._id })));
    const failedVerification = verifications.find((verification) => verification.result !== "VERIFIED");
    if (failedVerification) return res.status(422).json({ msg: "Medicine batch verification failed", riskSignals: failedVerification.riskSignals, verification: failedVerification });
    const receipt = await PharmacyGoodsReceipt.create({ purchaseOrder: order._id, shipment: req.body?.shipmentId || null, hospital, receivedBy: req.user?._id, items: normalizedReceivedItems, note: req.body?.note || "" });
    for (const received of normalizedReceivedItems) {
      const quantity = Number(received.receivedQuantity) || 0;
      if (!quantity) continue;
      const item = await PharmacyItem.findOne({ _id: received.itemId, hospital });
      if (!item) continue;
      const previousQuantity = Number(item.totalQuantity || 0);
      const batchNumber = String(received.batchNumber || "");
      const batch = item.batches.find((entry) => entry.batchNumber === batchNumber);
      const verification = verifications.find((entry) => String(entry.control.itemId) === String(received.itemId) && entry.control.batchNumber === batchNumber);
      if (batch) {
        batch.quantity += quantity;
        batch.verificationStatus = "VERIFIED";
        batch.regulatoryProduct = verification?.product?._id || null;
        batch.manufacturer = received.manufacturer || verification?.product?.manufacturer || "";
        batch.authenticityScore = verification?.control?.authenticityScore ?? 100;
      } else item.batches.push({ batchNumber, expiryDate: received.expiryDate || null, quantity, costPrice: orderItems.get(String(received.itemId)).unitCost, regulatoryProduct: verification?.product?._id || null, manufacturer: received.manufacturer || verification?.product?.manufacturer || "", verificationStatus: "VERIFIED", authenticityScore: verification?.control?.authenticityScore ?? 100 });
      item.totalQuantity += quantity;
      item.updatedBy = req.user?._id;
      await item.save();
      await PharmacyInventoryMovement.create({ itemId: item._id, hospital, movementType: "RECEIPT", batchNumber, expiryDate: received.expiryDate || null, quantity, previousQuantity, newQuantity: item.totalQuantity, referenceType: "PURCHASE_ORDER", note: `Goods receipt ${receipt._id}`, performedBy: req.user?._id });
    }
    await PharmacyPurchaseOrder.updateOne({ _id: order._id }, { $set: { status: "RECEIVED" } });
    await PharmacyShipment.updateOne({ purchaseOrder: order._id }, { $set: { status: "RECEIVED" } });
    await emitOperationalEvent({ type: "PHARMACY_PURCHASE_ORDER_RECEIVED", hospitalId: hospital, source: "pharmacy.procurement", actor: req.user?._id, payload: { resourceId: receipt._id, purchaseOrderId: order._id, notification: { title: "Purchase order received", body: `Goods receipt ${receipt._id} updated pharmacy inventory.`, category: "PROCUREMENT", meta: { receiptId: receipt._id, orderId: order._id } } } });
    res.status(201).json(receipt);
  } catch (err) {
    console.error("Purchase order receiving error:", err);
    res.status(500).json({ msg: "Failed to receive purchase order" });
  }
}

export async function createSupplierInvoice(req, res) {
  try {
    if (!supplierUser(req)) return res.status(403).json({ msg: "Supplier account required" });
    const order = await PharmacyPurchaseOrder.findOne({ _id: req.body?.purchaseOrderId, supplier: req.user?.supplier }).lean();
    if (!order) return res.status(404).json({ msg: "Purchase order not found" });
    const invoice = await PharmacySupplierInvoice.create({ purchaseOrder: order._id, hospital: order.hospital, supplier: order.supplier, invoiceNumber: req.body?.invoiceNumber, amount: Number(req.body?.amount) || order.totalAmount, dueAt: req.body?.dueAt });
    res.status(201).json(invoice);
  } catch (err) {
    console.error("Supplier invoice create error:", err);
    res.status(500).json({ msg: "Failed to create supplier invoice" });
  }
}

export async function recordSupplierPayment(req, res) {
  try {
    const hospital = ensureHospital(req, res);
    if (!hospital) return;
    const invoice = await PharmacySupplierInvoice.findOne({ _id: req.body?.invoiceId, hospital }).lean();
    if (!invoice) return res.status(404).json({ msg: "Supplier invoice not found" });
    const receipt = await PharmacyGoodsReceipt.findOne({ purchaseOrder: invoice.purchaseOrder, hospital }).lean();
    if (!receipt) return res.status(409).json({ msg: "Payment requires a goods receipt" });
    const blockedBatch = await PharmacyBatchControl.exists({ hospital, itemId: { $in: receipt.items.map((item) => item.itemId) }, batchNumber: { $in: receipt.items.map((item) => item.batchNumber) }, status: { $in: ["QUARANTINED", "RECALLED"] } });
    if (blockedBatch) return res.status(409).json({ msg: "Payment blocked while a received batch is under regulatory hold" });
    const payment = await PharmacySupplierPayment.create({ invoice: invoice._id, purchaseOrder: invoice.purchaseOrder, hospital, supplier: invoice.supplier, amount: Number(req.body?.amount) || invoice.amount, provider: req.body?.provider || "", reference: req.body?.reference, status: "SUCCESS", paidAt: new Date() });
    await PharmacySupplierInvoice.updateOne({ _id: invoice._id }, { $set: { status: "PAID" } });
    await PharmacyPurchaseOrder.updateOne({ _id: invoice.purchaseOrder }, { $set: { paymentStatus: "PAID", paymentReference: payment.reference } });
    const supplier = await PharmacySupplier.findById(invoice.supplier).select("users").lean();
    await notifyUsers({ users: supplier?.users || [], hospital, title: "Payment received", body: `Payment for invoice ${invoice.invoiceNumber} has been confirmed.`, category: "PAYMENT", meta: { paymentId: payment._id, invoiceId: invoice._id } });
    res.status(201).json(payment);
  } catch (err) {
    console.error("Supplier payment error:", err);
    res.status(500).json({ msg: "Failed to record supplier payment" });
  }
}
