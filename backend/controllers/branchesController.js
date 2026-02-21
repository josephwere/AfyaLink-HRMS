import Branch from "../models/Branch.js";

export const index = async (_req, res) => {
  res.json({ module: "branches", status: "ok" });
};

export const list = async (req, res) => {
  try {
    const hospital = req.user?.hospital;
    const items = await Branch.find({ hospital, active: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ data: items });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load branches" });
  }
};

export const create = async (req, res) => {
  try {
    const hospital = req.user?.hospital;
    const { name, location } = req.body || {};
    if (!name || !location) {
      return res.status(400).json({ error: "name and location are required" });
    }
    const branch = await Branch.create({
      hospital,
      name: String(name).trim(),
      location: String(location).trim(),
      createdBy: req.user?._id,
    });
    res.status(201).json({ data: branch });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create branch" });
  }
};

export const update = async (req, res) => {
  try {
    const hospital = req.user?.hospital;
    const { id } = req.params;
    const { name, location, active } = req.body || {};
    const branch = await Branch.findOne({ _id: id, hospital });
    if (!branch) return res.status(404).json({ error: "Branch not found" });

    if (name !== undefined) branch.name = String(name).trim();
    if (location !== undefined) branch.location = String(location).trim();
    if (active !== undefined) branch.active = Boolean(active);

    await branch.save();
    res.json({ data: branch });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update branch" });
  }
};

export const remove = async (req, res) => {
  try {
    const hospital = req.user?.hospital;
    const { id } = req.params;
    const branch = await Branch.findOne({ _id: id, hospital });
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    branch.active = false;
    await branch.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to remove branch" });
  }
};
