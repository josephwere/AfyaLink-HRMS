import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const uploadsRoot = path.resolve(process.cwd(), "uploads");

const MIME_EXTENSION_MAP = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

function resolvePublicBaseUrl(req) {
  const configured =
    process.env.PUBLIC_ASSET_CDN_URL ||
    process.env.PUBLIC_ASSET_BASE_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.API_PUBLIC_URL ||
    "";
  if (configured) return String(configured).replace(/\/+$/, "");

  const protocol =
    req?.headers?.["x-forwarded-proto"]?.split(",")?.[0]?.trim() ||
    req?.protocol ||
    "https";
  const host = req?.get?.("host");
  if (host) return `${protocol}://${host}`;
  return "";
}

function buildPublicUrl(req, relativePublicPath) {
  const normalizedPath = `/${String(relativePublicPath || "").replace(/^\/+/, "")}`;
  const base = resolvePublicBaseUrl(req);
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

function getAssetExtension(mime) {
  return MIME_EXTENSION_MAP[String(mime || "").toLowerCase()] || "bin";
}

function sanitizeSegment(value, fallback) {
  return String(value || fallback || "asset")
    .trim()
    .replace(/[^a-z0-9_-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function resolveStorageProvider() {
  const explicit = String(process.env.ASSET_STORAGE_PROVIDER || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    return "cloudinary";
  }
  return "local";
}

async function storeLocally({ buffer, req, folder, fileName }) {
  const absoluteDir = path.join(uploadsRoot, folder);
  const absolutePath = path.join(absoluteDir, fileName);
  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  const relativePath = path.posix.join("uploads", folder.replace(/\\/g, "/"), fileName);
  return {
    provider: "local",
    url: buildPublicUrl(req, relativePath),
    storageKey: relativePath,
  };
}

function buildCloudinarySignature(params, apiSecret) {
  const base = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(`${base}${apiSecret}`).digest("hex");
}

async function storeInCloudinary({ buffer, mime, folder, publicId }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary asset storage is not fully configured");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder,
    public_id: publicId,
    overwrite: "true",
    invalidate: "true",
    resource_type: "image",
    timestamp,
  };
  const signature = buildCloudinarySignature(params, apiSecret);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime || "application/octet-stream" }));
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("invalidate", "true");
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json?.error?.message ||
        json?.message ||
        `Cloudinary upload failed with status ${res.status}`
    );
  }

  return {
    provider: "cloudinary",
    url: json.secure_url || json.url,
    storageKey: json.public_id || publicId,
  };
}

export async function storeAssetBuffer({
  buffer,
  mime,
  req,
  scope = "system",
  scopeId = "global",
  field = "asset",
}) {
  if (!buffer?.length) {
    throw new Error("Asset buffer is required");
  }

  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 20);
  const extension = getAssetExtension(mime);
  const safeScope = sanitizeSegment(scope, "system");
  const safeScopeId = sanitizeSegment(scopeId, "global");
  const safeField = sanitizeSegment(field, "asset");
  const folder = path.posix.join("branding-assets", safeScope, safeScopeId);
  const fileName = `${safeField}-${hash}.${extension}`;
  const publicId = `${safeScope}__${safeScopeId}__${safeField}__${hash}`;
  const provider = resolveStorageProvider();

  if (provider === "cloudinary") {
    return storeInCloudinary({
      buffer,
      mime,
      folder: path.posix.join("afyalink", folder),
      publicId,
    });
  }

  return storeLocally({ buffer, req, folder, fileName });
}

export function getObjectStorageStatus() {
  const provider = resolveStorageProvider();
  return {
    provider,
    configured:
      provider === "cloudinary"
        ? Boolean(
            process.env.CLOUDINARY_CLOUD_NAME &&
              process.env.CLOUDINARY_API_KEY &&
              process.env.CLOUDINARY_API_SECRET
          )
        : true,
    publicBaseUrl: resolvePublicBaseUrl(),
  };
}
