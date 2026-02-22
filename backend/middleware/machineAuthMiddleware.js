import crypto from "crypto";
import MachineDevice from "../models/MachineDevice.js";

const DIGEST_ALGO = "sha256";

function hashApiKey(apiKey) {
  return crypto.createHash(DIGEST_ALGO).update(String(apiKey || "")).digest("hex");
}

function timingSafeEqual(a = "", b = "") {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifySignature(apiKey, ts, body, signature) {
  if (!apiKey || !ts || !signature) return false;
  const payload = `${ts}.${JSON.stringify(body || {})}`;
  const expected = crypto.createHmac(DIGEST_ALGO, String(apiKey)).update(payload).digest("hex");
  return timingSafeEqual(expected, String(signature));
}

export const machineAuth = async (req, res, next) => {
  try {
    const machineKey = req.headers["x-machine-key"] || req.headers["x-afya-machine-key"];
    const ts = req.headers["x-machine-ts"] || req.headers["x-afya-machine-ts"];
    const signature = req.headers["x-machine-signature"] || req.headers["x-afya-machine-signature"];

    if (!machineKey) {
      return res.status(401).json({ message: "Missing machine key" });
    }

    const keyHash = hashApiKey(machineKey);
    const device = await MachineDevice.findOne({ apiKeyHash: keyHash, active: true }).select("+apiKeyHash");
    if (!device) {
      return res.status(401).json({ message: "Invalid machine credentials" });
    }

    // Signature is optional for compatibility; when provided it must be valid and fresh.
    if (signature || ts) {
      if (!ts || !signature) {
        return res.status(401).json({ message: "Invalid machine signature headers" });
      }
      const tsMs = Number(ts);
      if (!Number.isFinite(tsMs)) {
        return res.status(401).json({ message: "Invalid machine timestamp" });
      }
      const skewMs = Math.abs(Date.now() - tsMs);
      if (skewMs > 5 * 60 * 1000) {
        return res.status(401).json({ message: "Machine signature expired" });
      }
      if (!verifySignature(machineKey, ts, req.body, signature)) {
        return res.status(401).json({ message: "Invalid machine signature" });
      }
    }

    req.machine = device;
    next();
  } catch (err) {
    next(err);
  }
};

export const buildMachineKey = () => crypto.randomBytes(32).toString("hex");
export const hashMachineKey = hashApiKey;

