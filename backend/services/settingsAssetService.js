import { storeAssetBuffer } from "./objectStorageService.js";

function isDataUrl(value) {
  return /^data:[^;]+;base64,/i.test(String(value || ""));
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  return {
    mime: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function persistDataUrlAsset(dataUrl, { req, scope, scopeId, field }) {
  if (!isDataUrl(dataUrl)) return dataUrl;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed?.buffer?.length) return dataUrl;

  const result = await storeAssetBuffer({
    buffer: parsed.buffer,
    mime: parsed.mime,
    req,
    scope,
    scopeId,
    field,
  });

  return result?.url || dataUrl;
}

async function persistRecord(record, options) {
  if (!record || typeof record !== "object") return record;
  // Process sequentially to keep peak memory low when migrating many base64 assets
  // (important for small-memory Render instances).
  const next = {};
  for (const [key, value] of Object.entries(record)) {
    next[key] = await persistDataUrlAsset(value, { ...options, field: key });
  }
  return next;
}

export async function persistSystemSettingsAssets({ req, branding, ai }) {
  let nextBranding = branding;
  let nextAi = ai;

  if (branding && typeof branding === "object") {
    nextBranding = {
      ...branding,
      appIcon: await persistDataUrlAsset(branding.appIcon, {
        req,
        scope: "system",
        scopeId: "global",
        field: "appIcon",
      }),
      favicon: await persistDataUrlAsset(branding.favicon, {
        req,
        scope: "system",
        scopeId: "global",
        field: "favicon",
      }),
      logo: await persistDataUrlAsset(branding.logo, {
        req,
        scope: "system",
        scopeId: "global",
        field: "logo",
      }),
      loginBackground: await persistDataUrlAsset(branding.loginBackground, {
        req,
        scope: "system",
        scopeId: "global",
        field: "loginBackground",
      }),
      homeBackground: await persistDataUrlAsset(branding.homeBackground, {
        req,
        scope: "system",
        scopeId: "global",
        field: "homeBackground",
      }),
    };
    if (branding.sidebarIcons && typeof branding.sidebarIcons === "object") {
      nextBranding.sidebarIcons = await persistRecord(branding.sidebarIcons, {
        req,
        scope: "system-sidebar",
        scopeId: "global",
      });
    }
  }

  if (ai && typeof ai === "object") {
    nextAi = {
      ...ai,
      icon: await persistDataUrlAsset(ai.icon, {
        req,
        scope: "system-ai",
        scopeId: "global",
        field: "icon",
      }),
    };
  }

  return { branding: nextBranding, ai: nextAi };
}

export async function persistHospitalCustomizationAssets({ req, hospitalId, customizationPatch }) {
  if (!customizationPatch || typeof customizationPatch !== "object") return customizationPatch;

  const next = { ...customizationPatch };
  const scopeId = hospitalId || "unknown-hospital";

  if (next.branding && typeof next.branding === "object") {
    next.branding = {
      ...next.branding,
      logo: await persistDataUrlAsset(next.branding.logo, {
        req,
        scope: "hospital-branding",
        scopeId,
        field: "logo",
      }),
      appIcon: await persistDataUrlAsset(next.branding.appIcon, {
        req,
        scope: "hospital-branding",
        scopeId,
        field: "appIcon",
      }),
      favicon: await persistDataUrlAsset(next.branding.favicon, {
        req,
        scope: "hospital-branding",
        scopeId,
        field: "favicon",
      }),
      loginBackground: await persistDataUrlAsset(next.branding.loginBackground, {
        req,
        scope: "hospital-branding",
        scopeId,
        field: "loginBackground",
      }),
      homeBackground: await persistDataUrlAsset(next.branding.homeBackground, {
        req,
        scope: "hospital-branding",
        scopeId,
        field: "homeBackground",
      }),
    };
  }

  return next;
}
