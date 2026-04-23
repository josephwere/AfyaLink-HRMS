const DEFAULT_PREFS = {
  textSize: "small", // small | normal | large | extra-large
  textSpacing: "normal", // compact | normal | relaxed
  inputSize: "compact", // compact | normal | large
};

const TEXT_SIZE_TO_ZOOM = {
  small: 0.95,
  normal: 1,
  large: 1.1,
  "extra-large": 1.2,
};

const TEXT_SPACING_TO_LINE_HEIGHT = {
  compact: 1.35,
  normal: 1.5,
  relaxed: 1.75,
};

const INPUT_SIZE_TO_SCALE = {
  compact: 0.92,
  normal: 1,
  large: 1.12,
};

function normalizePrefs(prefs) {
  return {
    textSize: prefs?.textSize || DEFAULT_PREFS.textSize,
    textSpacing: prefs?.textSpacing || DEFAULT_PREFS.textSpacing,
    inputSize: prefs?.inputSize || DEFAULT_PREFS.inputSize,
  };
}

function getUserKey(user) {
  const id = user?._id || user?.id || user?.email || user?.phone || "guest";
  return `afyalink_a11y_prefs:${String(id)}`;
}

export function loadAccessibilityPrefs(user) {
  const profilePrefs = user?.uiPreferences?.accessibility;
  if (profilePrefs && typeof profilePrefs === "object") {
    return normalizePrefs(profilePrefs);
  }
  try {
    const raw = localStorage.getItem(getUserKey(user));
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return normalizePrefs(parsed);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveAccessibilityPrefs(user, prefs) {
  const next = normalizePrefs(prefs);
  localStorage.setItem(getUserKey(user), JSON.stringify(next));
  return next;
}

export function applyAccessibilityPrefs(prefs) {
  const root = document.documentElement;
  const textSize = prefs?.textSize || DEFAULT_PREFS.textSize;
  const textSpacing = prefs?.textSpacing || DEFAULT_PREFS.textSpacing;
  const inputSize = prefs?.inputSize || DEFAULT_PREFS.inputSize;

  root.style.setProperty("--user-zoom", String(TEXT_SIZE_TO_ZOOM[textSize] || 1));
  root.style.setProperty(
    "--user-line-height",
    String(TEXT_SPACING_TO_LINE_HEIGHT[textSpacing] || 1.5)
  );
  root.style.setProperty("--user-input-scale", String(INPUT_SIZE_TO_SCALE[inputSize] || 1));
}

export function getDefaultAccessibilityPrefs() {
  return { ...DEFAULT_PREFS };
}
