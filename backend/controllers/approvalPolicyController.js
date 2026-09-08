import ApprovalPolicy from "../models/ApprovalPolicy.js";

export const listPolicies = async (req, res) => {
  const hospital = req.user?.hospital;
  const items = await ApprovalPolicy.find({ hospitalId: hospital }).sort({ createdAt: -1 }).lean();
  return res.json(items);
};

export const createPolicy = async (req, res) => {
  const hospital = req.user?.hospital;
  const payload = req.body || {};
  if (!payload.workflowType) return res.status(400).json({ message: "workflowType required" });
  const policy = await ApprovalPolicy.create({ hospitalId: hospital, ...payload });
  return res.status(201).json(policy);
};

export const getPolicy = async (req, res) => {
  const hospital = req.user?.hospital;
  const { id } = req.params;
  const policy = await ApprovalPolicy.findOne({ _id: id, hospitalId: hospital }).lean();
  if (!policy) return res.status(404).json({ message: "Not found" });
  return res.json(policy);
};

export const updatePolicy = async (req, res) => {
  const hospital = req.user?.hospital;
  const { id } = req.params;
  const payload = req.body || {};
  const policy = await ApprovalPolicy.findOneAndUpdate({ _id: id, hospitalId: hospital }, { $set: payload }, { new: true }).lean();
  if (!policy) return res.status(404).json({ message: "Not found" });
  return res.json(policy);
};

export const deletePolicy = async (req, res) => {
  const hospital = req.user?.hospital;
  const { id } = req.params;
  const policy = await ApprovalPolicy.findOneAndDelete({ _id: id, hospitalId: hospital });
  if (!policy) return res.status(404).json({ message: "Not found" });
  return res.status(204).end();
};

export const simulatePolicy = async (req, res) => {
  const hospital = req.user?.hospital;
  const { workflowType, amount } = req.body || {};
  if (!workflowType) return res.status(400).json({ message: "workflowType required" });
  const { getPolicyForType } = await import("../services/approvalPolicyService.js");
  const policy = await getPolicyForType({ hospitalId: hospital, workflowType, amount });
  return res.json({ policy });
};
