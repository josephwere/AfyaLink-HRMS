// backend/controllers/superAdmin.js
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import { issuePasswordResetLink, resolveFrontendBase } from "../utils/passwordReset.js";

const createProtectedGlobalUser = async ({ name, email, password, role }) => {
  if (await User.findOne({ email })) {
    return { error: { status: 400, msg: "Email already exists" } };
  }

  const user = await User.create({
    name,
    email,
    password,
    passwordSetAt: new Date(),
    role,
    emailVerified: true,
    twoFactorEnabled: true,
    protectedAccount: true,
  });

  return { user };
};

const buildProtectedGlobalUserFilter = ({ role, q = "", active, authProvider = "", status = "" }) => {
  const filter = { role, protectedAccount: true };
  const search = String(q || "").trim();
  const provider = String(authProvider || "").trim().toLowerCase();
  const systemStatus = String(status || "").trim().toUpperCase();

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  if (active === "true") filter.active = true;
  if (active === "false") filter.active = false;
  if (provider) filter.authProvider = provider;
  if (systemStatus) filter["systemProfile.status"] = systemStatus;

  return filter;
};

const computeActivityMetrics = (row) => {
  const now = Date.now();
  const lastLoginAt = row?.sessionSecurity?.lastLoginAt ? new Date(row.sessionSecurity.lastLoginAt) : null;
  const lastActivityAt = row?.systemProfile?.lastActivityAt ? new Date(row.systemProfile.lastActivityAt) : null;
  const createdAt = row?.createdAt ? new Date(row.createdAt) : null;
  const trustedDeviceCount = Array.isArray(row?.trustedDevices) ? row.trustedDevices.length : 0;
  const daysSinceLastLogin = lastLoginAt
    ? Math.max(0, Math.floor((now - lastLoginAt.getTime()) / (24 * 60 * 60 * 1000)))
    : null;
  const accountAgeDays = createdAt
    ? Math.max(0, Math.floor((now - createdAt.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;

  let bucket = "NEVER_LOGGED_IN";
  if (daysSinceLastLogin !== null) {
    if (daysSinceLastLogin <= 1) bucket = "ACTIVE_TODAY";
    else if (daysSinceLastLogin <= 7) bucket = "ACTIVE_7D";
    else if (daysSinceLastLogin <= 30) bucket = "STALE_30D";
    else bucket = "DORMANT";
  }

  return {
    trustedDeviceCount,
    daysSinceLastLogin,
    accountAgeDays,
    lastLoginAt: lastLoginAt ? lastLoginAt.toISOString() : null,
    lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
    bucket,
  };
};

const serializeProtectedGlobalUser = (row) => {
  const activityMetrics = computeActivityMetrics(row);
  return {
    _id: row._id,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    role: row.role,
    active: row.active !== false,
    authProvider: row.authProvider || "local",
    protectedAccount: Boolean(row.protectedAccount),
    createdAt: row.createdAt,
    passwordSetAt: row.passwordSetAt || null,
    resetPasswordRequestedAt: row.resetPasswordRequestedAt || null,
    systemProfile: {
      status: row?.systemProfile?.status || "ACTIVE",
      lastActivityAt: row?.systemProfile?.lastActivityAt || null,
    },
    sessionSecurity: {
      lastLoginAt: row?.sessionSecurity?.lastLoginAt || null,
    },
    activityMetrics,
  };
};

const listProtectedGlobalUsers = async ({ req, res, role }) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const filter = buildProtectedGlobalUserFilter({
      role,
      q: req.query.q,
      active: req.query.active,
      authProvider: req.query.authProvider,
      status: req.query.status,
    });

    const [items, total] = await Promise.all([
      User.find(filter)
        .select(
          "name email phone role active authProvider protectedAccount createdAt passwordSetAt resetPasswordRequestedAt systemProfile.status systemProfile.lastActivityAt sessionSecurity.lastLoginAt trustedDevices"
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const serializedItems = items.map(serializeProtectedGlobalUser);
    const summary = {
      total,
      active: serializedItems.filter((row) => row.active).length,
      disabled: serializedItems.filter((row) => !row.active).length,
      activeToday: serializedItems.filter((row) => row.activityMetrics.bucket === "ACTIVE_TODAY").length,
      active7d: serializedItems.filter((row) =>
        ["ACTIVE_TODAY", "ACTIVE_7D"].includes(row.activityMetrics.bucket)
      ).length,
      neverLoggedIn: serializedItems.filter((row) => row.activityMetrics.bucket === "NEVER_LOGGED_IN").length,
      pendingResets: serializedItems.filter((row) => row.resetPasswordRequestedAt).length,
    };

    return res.json({ items: serializedItems, total, page, limit, summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error" });
  }
};

const updateProtectedGlobalUser = async ({ req, res, role }) => {
  try {
    const { id } = req.params;
    const { name, email, phone, active, status } = req.body || {};

    const user = await User.findOne({ _id: id, role, protectedAccount: true });
    if (!user) {
      return res.status(404).json({ msg: "Account not found" });
    }

    if (name !== undefined) user.name = String(name || "").trim();
    if (email !== undefined) user.email = String(email || "").trim().toLowerCase();
    if (phone !== undefined) user.phone = String(phone || "").trim() || undefined;
    if (active !== undefined) user.active = Boolean(active);
    if (status !== undefined) {
      user.systemProfile = user.systemProfile || {};
      user.systemProfile.status = String(status || "ACTIVE").trim().toUpperCase();
    }

    await user.save();

    const out = await User.findById(user._id)
      .select(
        "name email phone role active authProvider protectedAccount createdAt passwordSetAt resetPasswordRequestedAt systemProfile.status systemProfile.lastActivityAt sessionSecurity.lastLoginAt trustedDevices"
      )
      .lean();

    return res.json({ success: true, user: serializeProtectedGlobalUser(out) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ msg: "Email or phone already exists" });
    }
    console.error(err);
    return res.status(500).json({ msg: "Server error" });
  }
};

// Create a Hospital Admin
export const registerHospitalAdmin = async (req, res) => {
  const { name, email, password, hospitalId, branch } = req.body;

  if (!name || !email || !password || !hospitalId) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  try {
    // Check email uniqueness
    if (await User.findOne({ email })) return res.status(400).json({ msg: "Email already exists" });

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ msg: "Hospital not found" });
    if (hospital.verification?.status !== "VERIFIED") {
      return res.status(400).json({
        msg: "Hospital must be government verified before a hospital admin can be assigned.",
      });
    }

    // Create hospital admin
    const admin = await User.create({
      name,
      email,
      password,
      role: "HOSPITAL_ADMIN",
      hospital: hospital._id,
      employment: {
        ...(branch ? { branch: String(branch).trim() } : {}),
      },
      emailVerified: true,
      twoFactorEnabled: true,
      protectedAccount: true,
    });
    hospital.admins = hospital.admins || [];
    if (!hospital.admins.some((id) => String(id) === String(admin._id))) {
      hospital.admins.push(admin._id);
    }
    await hospital.save();

    // Return admin summary
    res.status(201).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        hospital: hospital._id,
        branch: admin?.employment?.branch || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Create another system admin (SUPER_ADMIN)
export const registerSystemAdmin = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  try {
    const result = await createProtectedGlobalUser({
      name,
      email,
      password,
      role: "SYSTEM_ADMIN",
    });

    if (result.error) {
      return res.status(result.error.status).json({ msg: result.error.msg });
    }
    const admin = result.user;

    res.status(201).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Create a human super assistant (SUPER_ASSISTANT)
export const registerSuperAssistant = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  try {
    const result = await createProtectedGlobalUser({
      name,
      email,
      password,
      role: "SUPER_ASSISTANT",
    });

    if (result.error) {
      return res.status(result.error.status).json({ msg: result.error.msg });
    }
    const assistant = result.user;

    res.status(201).json({
      success: true,
      admin: {
        id: assistant._id,
        name: assistant.name,
        email: assistant.email,
        role: assistant.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Create a developer (DEVELOPER)
export const registerDeveloper = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  try {
    const result = await createProtectedGlobalUser({
      name,
      email,
      password,
      role: "DEVELOPER",
    });

    if (result.error) {
      return res.status(result.error.status).json({ msg: result.error.msg });
    }
    const dev = result.user;

    res.status(201).json({
      success: true,
      admin: {
        id: dev._id,
        name: dev.name,
        email: dev.email,
        role: dev.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Get all hospitals
export const getHospitals = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const q = String(req.query.q || "").trim();
    const withoutAdmin = String(req.query.withoutAdmin || "").toLowerCase() === "true";
    const verified = String(req.query.verified || "").toLowerCase();

    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
        { contact: { $regex: q, $options: "i" } },
      ];
    }

    if (withoutAdmin) {
      filter.$or = filter.$or || [];
      const noAdminsClauses = [{ admins: { $exists: false } }, { admins: { $size: 0 } }];
      if (filter.$or.length) {
        filter.$and = [{ $or: filter.$or }, { $or: noAdminsClauses }];
        delete filter.$or;
      } else {
        filter.$or = noAdminsClauses;
      }
    }
    if (verified === "true") filter["verification.status"] = "VERIFIED";
    if (verified === "false") filter["verification.status"] = { $ne: "VERIFIED" };

    const [rows, total] = await Promise.all([
      Hospital.find(filter)
        .populate("admins", "name email employment.branch")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Hospital.countDocuments(filter),
    ]);

    const now = new Date();
    const items = rows.map((h) => {
      const trialEndsAt = h?.subscription?.trialEndsAt ? new Date(h.subscription.trialEndsAt) : null;
      const status = h?.subscription?.status || "TRIAL";
      const paid = status === "ACTIVE";
      const trialExpired = trialEndsAt ? now > trialEndsAt : false;
      const premiumPaused = Boolean(h?.subscription?.premiumPaused) || (trialExpired && !paid);
      return {
        ...h,
        verificationSummary: {
          status: h?.verification?.status || "UNVERIFIED",
          registrationNumber: h?.verification?.registrationNumber || "",
          approvalDate: h?.verification?.approvalDate || null,
          expiresAt: h?.verification?.expiresAt || null,
          publicVisible: Boolean(h?.verification?.publicVisible),
          badgeLabel: h?.verification?.badgeLabel || "Government Approved",
        },
        subscriptionState: {
          status,
          trialEndsAt,
          trialExpired,
          premiumPaused,
          daysLeft: trialEndsAt
            ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
            : 0,
        },
      };
    });

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// List hospital admins with hospital/branch/search filters
export const listHospitalAdmins = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const hospitalId = req.query.hospitalId;
    const branch = (req.query.branch || "").trim();
    const q = (req.query.q || "").trim();

    const filter = { role: "HOSPITAL_ADMIN" };
    if (hospitalId) filter.hospital = hospitalId;
    if (branch) filter["employment.branch"] = branch;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name email hospital employment.branch active createdAt")
        .populate("hospital", "name code")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

export const updateHospitalAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, branch, active } = req.body || {};

    const admin = await User.findOne({ _id: id, role: "HOSPITAL_ADMIN" });
    if (!admin) {
      return res.status(404).json({ msg: "Hospital admin not found" });
    }

    if (name !== undefined) admin.name = String(name).trim();
    if (email !== undefined) admin.email = String(email).trim().toLowerCase();
    if (branch !== undefined) {
      admin.employment = admin.employment || {};
      admin.employment.branch = String(branch || "").trim();
    }
    if (active !== undefined) admin.active = Boolean(active);

    await admin.save();

    const out = await User.findById(admin._id)
      .select("name email hospital employment.branch active createdAt")
      .populate("hospital", "name code")
      .lean();

    return res.json({ success: true, admin: out });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ msg: "Email already exists" });
    }
    console.error(err);
    return res.status(500).json({ msg: "Server error" });
  }
};

export const listSuperAssistants = async (req, res) =>
  listProtectedGlobalUsers({ req, res, role: "SUPER_ASSISTANT" });

export const updateSuperAssistant = async (req, res) =>
  updateProtectedGlobalUser({ req, res, role: "SUPER_ASSISTANT" });

export const sendSuperAssistantResetLink = async (req, res) => {
  try {
    const { id } = req.params;
    const assistant = await User.findOne({ _id: id, role: "SUPER_ASSISTANT", protectedAccount: true });
    if (!assistant) {
      return res.status(404).json({ msg: "Super assistant not found" });
    }
    if (!assistant.email) {
      return res.status(400).json({ msg: "Super assistant must have an email address to receive a reset link" });
    }

    const invite = !assistant?.sessionSecurity?.lastLoginAt;
    const result = await issuePasswordResetLink({
      user: assistant,
      frontendBase: resolveFrontendBase(req),
      actorId: req.user?._id,
      actorRole: req.user?.role,
      invite,
      metadata: {
        requestedByAdmin: true,
        targetRole: assistant.role,
      },
    });

    return res.json({
      success: true,
      mode: invite ? "invite" : "reset",
      resetLink: result.resetLink,
      expiresAt: result.expiresAt,
      msg: invite ? "Invite link sent to super assistant." : "Reset link sent to super assistant.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Unable to send reset link" });
  }
};

export const bulkUpdateSuperAssistants = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
    const action = String(req.body?.action || "").trim().toUpperCase();
    const status = String(req.body?.status || "").trim().toUpperCase();

    if (!ids.length) {
      return res.status(400).json({ msg: "Select at least one super assistant" });
    }
    if (!action) {
      return res.status(400).json({ msg: "Action is required" });
    }

    const assistants = await User.find({
      _id: { $in: ids },
      role: "SUPER_ASSISTANT",
      protectedAccount: true,
    });

    if (!assistants.length) {
      return res.status(404).json({ msg: "No matching super assistants found" });
    }

    if (action === "SEND_RESET_LINK") {
      const frontendBase = resolveFrontendBase(req);
      let sent = 0;
      for (const assistant of assistants) {
        if (!assistant.email) continue;
        const invite = !assistant?.sessionSecurity?.lastLoginAt;
        await issuePasswordResetLink({
          user: assistant,
          frontendBase,
          actorId: req.user?._id,
          actorRole: req.user?.role,
          invite,
          metadata: {
            requestedByAdmin: true,
            bulk: true,
            targetRole: assistant.role,
          },
        });
        sent += 1;
      }
      return res.json({
        success: true,
        updatedCount: sent,
        msg: `Sent ${sent} invite/reset link${sent === 1 ? "" : "s"}.`,
      });
    }

    if (action === "SET_STATUS" && !status) {
      return res.status(400).json({ msg: "Status is required for set status" });
    }

    for (const assistant of assistants) {
      if (action === "ENABLE") {
        assistant.active = true;
        if (assistant?.systemProfile?.status === "SUSPENDED") {
          assistant.systemProfile = assistant.systemProfile || {};
          assistant.systemProfile.status = "ACTIVE";
        }
      } else if (action === "DISABLE") {
        assistant.active = false;
        assistant.systemProfile = assistant.systemProfile || {};
        assistant.systemProfile.status = "SUSPENDED";
      } else if (action === "SET_STATUS") {
        assistant.systemProfile = assistant.systemProfile || {};
        assistant.systemProfile.status = status;
      } else {
        return res.status(400).json({ msg: "Unsupported bulk action" });
      }
      await assistant.save();
    }

    return res.json({
      success: true,
      updatedCount: assistants.length,
      msg: `Updated ${assistants.length} super assistant account${assistants.length === 1 ? "" : "s"}.`,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ msg: "A duplicate email or phone value already exists" });
    }
    console.error(err);
    return res.status(500).json({ msg: "Unable to run bulk action" });
  }
};
