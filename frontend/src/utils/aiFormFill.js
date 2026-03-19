const FIELD_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox'], [data-ai-field]";
const ACTION_SELECTOR = "[data-ai-action]";
const IGNORED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "file", "image"]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitAliases(value) {
  return String(value || "")
    .split(/[|,]/)
    .map((entry) => compactText(entry))
    .filter(Boolean);
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => compactText(value))
        .filter(Boolean)
    )
  );
}

function isIgnoredNode(element) {
  return Boolean(
    element.closest(".ai-panel") ||
      element.closest(".ai-chat-page") ||
      element.closest(".ai-evidence-drawer") ||
      element.closest("[data-ai-ignore-fill='true']")
  );
}

function isVisible(element) {
  if (!element || isIgnoredNode(element)) return false;
  if (element.disabled) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findLabelText(element) {
  const direct = Array.from(element.labels || [])
    .map((label) => compactText(label.textContent))
    .filter(Boolean)
    .join(" ");
  if (direct) return direct;

  const ariaLabel = compactText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => compactText(document.getElementById(id)?.textContent))
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }

  const wrappingLabel = element.closest("label");
  if (wrappingLabel) {
    const text = compactText(wrappingLabel.textContent);
    if (text) return text;
  }

  const previousLabel = element.previousElementSibling;
  if (previousLabel?.tagName === "LABEL") {
    const text = compactText(previousLabel.textContent);
    if (text) return text;
  }

  const fieldset = element.closest("fieldset");
  const legend = fieldset?.querySelector("legend");
  if (legend) {
    const text = compactText(legend.textContent);
    if (text) return text;
  }

  return (
    compactText(element.getAttribute?.("placeholder")) ||
    compactText(element.getAttribute?.("data-ai-label")) ||
    compactText(element.name) ||
    compactText(element.id)
  );
}

function getSectionText(element) {
  const container =
    element.closest(".card, form, section, fieldset, .modal, .drawer, .panel") || element.parentElement;
  if (!container) return "";
  const heading = container.querySelector("h1, h2, h3, h4, h5, h6, legend");
  return compactText(heading?.textContent);
}

function getActionContextText(element) {
  const explicit = compactText(element.getAttribute?.("data-ai-help"));
  if (explicit) return explicit;

  const row = element.closest("tr, li, .card, .panel, .list-item");
  if (!row) return "";
  const clone = row.cloneNode(true);
  clone.querySelectorAll("[data-ai-action]").forEach((node) => node.remove());
  return compactText(clone.textContent).slice(0, 240);
}

function buildKey(prefix, seed) {
  return `${prefix}-${normalizeText(seed).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "field"}`;
}

function isNativeField(element) {
  if (!element) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

function isContentEditableField(element) {
  return Boolean(element?.isContentEditable || element?.getAttribute?.("contenteditable") === "true");
}

function resolveInteractiveElement(element) {
  if (!element) return null;
  if (isNativeField(element) || isContentEditableField(element)) return element;
  const nested = element.querySelector?.("input, textarea, select, [contenteditable='true']");
  return nested || element;
}

function escapeSelector(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function toSerializableField(field) {
  return {
    key: field.key,
    label: field.label,
    name: field.name,
    id: field.id,
    type: field.type,
    placeholder: field.placeholder,
    required: field.required,
    section: field.section,
    aliases: field.aliases || [],
    widget: field.widget || "",
    intent: field.intent || "",
    priority: field.priority || "normal",
    helpText: field.helpText || "",
    options: field.options || [],
  };
}

function describeSelectOptions(element) {
  return Array.from(element.options || [])
    .map((option) => ({
      value: compactText(option.value),
      label: compactText(option.textContent),
    }))
    .filter((option) => option.value || option.label)
    .slice(0, 25);
}

function describeAttributeOptions(element) {
  const raw = compactText(element.getAttribute?.("data-ai-field-options"));
  if (!raw) return [];
  return raw
    .split("|")
    .map((entry) => {
      const [label, value] = String(entry || "").split("=>").map((part) => compactText(part));
      return {
        label: label || value,
        value: value || label,
      };
    })
    .filter((option) => option.label || option.value);
}

function getCheckboxValueHint(element) {
  return compactText(element.value) && element.value !== "on" ? compactText(element.value) : "";
}

function collectRadioGroups(elements) {
  const seen = new Set();
  const fields = [];

  for (const element of elements) {
    if (element.type !== "radio" || !isVisible(element)) continue;
    const name = compactText(element.name || element.id || findLabelText(element));
    const scope = element.form || document;
    const groupSelector = element.name ? `input[type="radio"][name="${escapeSelector(element.name)}"]` : null;
    const radios = groupSelector
      ? Array.from(scope.querySelectorAll(groupSelector)).filter((radio) => isVisible(radio))
      : [element];
    if (!radios.length) continue;
    const groupKeySeed = radios[0].name || radios[0].id || findLabelText(radios[0]);
    const groupKey = buildKey("radio", groupKeySeed);
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);

    fields.push({
      key: groupKey,
      label: findLabelText(radios[0]),
      name,
      id: radios[0].id || "",
      type: "radio",
      placeholder: "",
      required: radios.some((radio) => radio.required),
      section: getSectionText(radios[0]),
      options: radios.map((radio) => ({
        value: compactText(radio.value),
        label: compactText(findLabelText(radio)),
      })),
      elements: radios,
    });
  }

  return fields;
}

export function collectPageFormFields() {
  if (typeof document === "undefined") return [];

  const rawElements = Array.from(document.querySelectorAll(FIELD_SELECTOR));
  const deduped = [];
  const seen = new Set();

  for (const rawElement of rawElements) {
    const element = resolveInteractiveElement(rawElement);
    if (!element || seen.has(element)) continue;
    seen.add(element);
    deduped.push(element);
  }

  const fields = [];

  for (const element of deduped) {
    if (!isVisible(element)) continue;
    if (element.tagName === "INPUT" && IGNORED_INPUT_TYPES.has(String(element.type || "").toLowerCase())) {
      continue;
    }
    if (element.type === "radio") continue;

    const label = findLabelText(element);
    const name = compactText(element.name);
    const id = compactText(element.id);
    const placeholder = compactText(element.getAttribute("placeholder"));
    const aliases = uniqueStrings(splitAliases(element.getAttribute("data-ai-aliases")));
    const type = isContentEditableField(element)
      ? "richtext"
      : element.tagName === "SELECT"
      ? "select"
      : element.type === "checkbox"
      ? "checkbox"
      : compactText(element.getAttribute("role") || element.type || element.tagName).toLowerCase();

    fields.push({
      key: buildKey(type, [name, id, label, placeholder].filter(Boolean).join(" ")),
      label,
      name,
      id,
      type,
      placeholder,
      required: Boolean(element.required),
      section: getSectionText(element),
      aliases,
      widget: compactText(element.getAttribute("data-ai-widget")),
      intent: compactText(element.getAttribute("data-ai-intent")),
      priority: compactText(element.getAttribute("data-ai-priority")) || "normal",
      helpText: compactText(element.getAttribute("data-ai-help")),
      options:
        type === "select"
          ? [...describeSelectOptions(element), ...describeAttributeOptions(element)]
          : type === "checkbox"
          ? [{ value: getCheckboxValueHint(element) || "true", label: label || "checkbox" }]
          : describeAttributeOptions(element).length
          ? describeAttributeOptions(element)
          : [],
      element,
    });
  }

  const allFields = [...fields, ...collectRadioGroups(deduped)];
  const counts = new Map();

  return allFields.map((field) => {
    const count = (counts.get(field.key) || 0) + 1;
    counts.set(field.key, count);
    return count === 1 ? field : { ...field, key: `${field.key}-${count}` };
  });
}

export function collectPageActionTargets() {
  if (typeof document === "undefined") return [];

  const elements = Array.from(document.querySelectorAll(ACTION_SELECTOR)).filter((element) => isVisible(element));
  const targets = [];
  const counts = new Map();

  for (const element of elements) {
    const actionType = compactText(element.getAttribute("data-ai-action"));
    if (!actionType) continue;

    const label =
      compactText(element.getAttribute("data-ai-label")) ||
      compactText(element.getAttribute("aria-label")) ||
      compactText(element.textContent) ||
      actionType;
    const keySeed = [actionType, label, getActionContextText(element)].filter(Boolean).join(" ");
    const key = buildKey("action", keySeed);
    const count = (counts.get(key) || 0) + 1;
    counts.set(key, count);

    targets.push({
      key: count === 1 ? key : `${key}-${count}`,
      label,
      actionType,
      section: getSectionText(element),
      aliases: uniqueStrings(splitAliases(element.getAttribute("data-ai-aliases"))),
      helpText: getActionContextText(element),
      element,
    });
  }

  return targets;
}

function setNativeValue(element, value) {
  if (!element) return;
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeChecked(element, checked) {
  if (!element) return;
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "checked");
  if (descriptor?.set) {
    descriptor.set.call(element, checked);
  } else {
    element.checked = checked;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setRichTextValue(element, value) {
  const nextValue = value == null ? "" : String(value);
  element.focus?.();
  if ("innerText" in element) {
    element.innerText = nextValue;
  } else {
    element.textContent = nextValue;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value);
  return ["true", "yes", "1", "checked", "on"].includes(normalized);
}

function matchOption(options, desired) {
  const normalized = normalizeText(desired);
  return (
    options.find((option) => normalizeText(option.value) === normalized) ||
    options.find((option) => normalizeText(option.label) === normalized) ||
    options.find((option) => normalizeText(option.label).includes(normalized)) ||
    options.find((option) => normalizeText(option.value).includes(normalized)) ||
    null
  );
}

function normalizeTemporalValue(type, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  if (type === "date") {
    return parsed.toISOString().slice(0, 10);
  }
  if (type === "time") {
    return parsed.toISOString().slice(11, 16);
  }
  if (type === "datetime-local") {
    return `${parsed.toISOString().slice(0, 10)}T${parsed.toISOString().slice(11, 16)}`;
  }
  return raw;
}

function findField(fields, assignment) {
  const candidates = [
    assignment?.fieldKey,
    assignment?.key,
    assignment?.field,
    assignment?.label,
    assignment?.name,
    assignment?.id,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    const exact =
      fields.find((field) => normalizeText(field.key) === candidate) ||
      fields.find((field) => normalizeText(field.label) === candidate) ||
      fields.find((field) => normalizeText(field.name) === candidate) ||
      fields.find((field) => normalizeText(field.id) === candidate) ||
      fields.find((field) => (field.aliases || []).some((alias) => normalizeText(alias) === candidate));
    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const partial =
      fields.find((field) => normalizeText(field.label).includes(candidate)) ||
      fields.find((field) => normalizeText(field.name).includes(candidate)) ||
      fields.find((field) => normalizeText(field.key).includes(candidate)) ||
      fields.find((field) => (field.aliases || []).some((alias) => normalizeText(alias).includes(candidate)));
    if (partial) return partial;
  }

  return null;
}

export function resolveAiAssignments(fields, assignments = []) {
  return assignments.map((assignment, index) => {
    const target = findField(fields, assignment);
    return {
      index,
      assignment,
      field: target || null,
      ok: Boolean(target),
      fieldLabel: target?.label || target?.name || target?.id || target?.key || assignment?.fieldKey || assignment?.label || "Unknown field",
      reason: target ? "" : "Field not found on this page",
    };
  });
}

function applyValue(field, value) {
  if (field.type === "radio") {
    const option = matchOption(field.options || [], value);
    const target = field.elements.find((element) => {
      const label = findLabelText(element);
      return normalizeText(element.value) === normalizeText(option?.value || value) || normalizeText(label) === normalizeText(option?.label || value);
    });
    if (!target) {
      throw new Error(`No radio option matched "${value}"`);
    }
    setNativeChecked(target, true);
    return option?.label || option?.value || String(value);
  }

  const element = field.element;
  if (!element) throw new Error("Field element not found");

  if (field.type === "checkbox") {
    const checked = coerceBoolean(value);
    setNativeChecked(element, checked);
    return checked;
  }

  if (field.type === "select") {
    const option = matchOption(field.options || [], value);
    if (!option) throw new Error(`No option matched "${value}"`);
    setNativeValue(element, option.value || option.label);
    return option.label || option.value;
  }

  if (field.type === "richtext" || field.type === "textbox" || field.type === "combobox") {
    const nextValue = value == null ? "" : String(value);
    if (isNativeField(element)) {
      setNativeValue(element, nextValue);
    } else {
      setRichTextValue(element, nextValue);
    }
    return nextValue;
  }

  const nextValue =
    field.type === "date" || field.type === "time" || field.type === "datetime-local"
      ? normalizeTemporalValue(field.type, value)
      : value == null
      ? ""
      : String(value);
  setNativeValue(element, nextValue);
  return nextValue;
}

export function applyAiAssignments(fields, assignments = []) {
  const results = [];
  const resolved = resolveAiAssignments(fields, assignments);

  for (const item of resolved) {
    const assignment = item.assignment;
    const target = item.field;
    if (!target) {
      results.push({
        ok: false,
        field: assignment?.fieldKey || assignment?.label || assignment?.name || "Unknown field",
        reason: "Field not found on this page",
      });
      continue;
    }

    try {
      const applied = applyValue(target, assignment?.value);
      results.push({
        ok: true,
        field: target.label || target.name || target.key,
        value: applied,
        confidence: assignment?.confidence ?? null,
      });
    } catch (error) {
      results.push({
        ok: false,
        field: target.label || target.name || target.key,
        reason: error?.message || "Failed to apply value",
      });
    }
  }

  return results;
}

export function serializePageFormFields(fields = []) {
  return fields.map(toSerializableField);
}

export function serializePageActionTargets(targets = []) {
  return targets.map((target) => ({
    key: target.key,
    label: target.label,
    actionType: target.actionType,
    section: target.section || "",
    aliases: target.aliases || [],
    helpText: target.helpText || "",
  }));
}

function findActionTarget(targets, action) {
  const candidates = [
    action?.actionKey,
    action?.key,
    action?.actionType,
    action?.label,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    const exact =
      targets.find((target) => normalizeText(target.key) === candidate) ||
      targets.find((target) => normalizeText(target.label) === candidate) ||
      targets.find((target) => normalizeText(target.actionType) === candidate) ||
      targets.find((target) => (target.aliases || []).some((alias) => normalizeText(alias) === candidate));
    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const partial =
      targets.find((target) => normalizeText(target.key).includes(candidate)) ||
      targets.find((target) => normalizeText(target.label).includes(candidate)) ||
      targets.find((target) => normalizeText(target.actionType).includes(candidate)) ||
      targets.find((target) => normalizeText(target.helpText).includes(candidate)) ||
      targets.find((target) => (target.aliases || []).some((alias) => normalizeText(alias).includes(candidate)));
    if (partial) return partial;
  }

  return null;
}

export function resolveAiActions(targets, actions = []) {
  return actions.map((action, index) => {
    const target = findActionTarget(targets, action);
    return {
      index,
      action,
      target: target || null,
      ok: Boolean(target),
      actionLabel: target?.label || action?.label || action?.actionType || action?.actionKey || "Unknown action",
      reason: target ? "" : "Action not found on this page",
    };
  });
}

function triggerActionTarget(target) {
  const element = target?.element;
  if (!element) {
    throw new Error("Action element not found");
  }
  element.focus?.({ preventScroll: false });
  element.click?.();
  return target.label || target.actionType || "Action executed";
}

export function applyAiActions(targets, actions = []) {
  const results = [];
  const resolved = resolveAiActions(targets, actions);

  for (const item of resolved) {
    const action = item.action;
    const target = item.target;
    if (!target) {
      results.push({
        ok: false,
        field: action?.actionKey || action?.label || action?.actionType || "Unknown action",
        reason: "Action not found on this page",
      });
      continue;
    }

    try {
      const applied = triggerActionTarget(target);
      results.push({
        ok: true,
        field: target.label || target.actionType || target.key,
        value: applied,
        confidence: action?.confidence ?? null,
      });
    } catch (error) {
      results.push({
        ok: false,
        field: target.label || target.actionType || target.key,
        reason: error?.message || "Failed to execute action",
      });
    }
  }

  return results;
}

function getFocusableFields() {
  return collectPageFormFields().filter((field) => field.element && isVisible(field.element));
}

function focusFieldElement(element) {
  if (!element) return null;
  const target = resolveInteractiveElement(element);
  target?.focus?.({ preventScroll: false });
  if (target && typeof target.select === "function" && ["text", "search", "email", "tel", "url", "number"].includes(String(target.type || "").toLowerCase())) {
    target.select();
  }
  target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  return target;
}

function getFieldForActiveElement(fields = getFocusableFields()) {
  if (typeof document === "undefined") return { index: -1, field: null };
  const active = document.activeElement;
  if (!active) return { index: -1, field: null };
  const index = fields.findIndex((field) => {
    const element = field.element;
    return element === active || element?.contains?.(active) || active?.contains?.(element);
  });
  return {
    index,
    field: index >= 0 ? fields[index] : null,
  };
}

export function getFocusedFieldContext() {
  const fields = getFocusableFields();
  const { field } = getFieldForActiveElement(fields);
  if (!field) return null;
  return {
    key: field.key,
    label: field.label || field.name || field.id || "Focused field",
    section: field.section || "",
    type: field.type,
  };
}

export function focusRelativeField(step = 1) {
  const fields = getFocusableFields();
  if (!fields.length) return null;
  const { index } = getFieldForActiveElement(fields);
  const nextIndex = index < 0 ? 0 : Math.max(0, Math.min(fields.length - 1, index + step));
  const field = fields[nextIndex];
  focusFieldElement(field?.element);
  return field || null;
}

export function focusNextField() {
  return focusRelativeField(1);
}

export function focusPreviousField() {
  return focusRelativeField(-1);
}

export function focusNextSection() {
  const fields = getFocusableFields();
  if (!fields.length) return null;
  const { index, field: current } = getFieldForActiveElement(fields);
  const currentSection = normalizeText(current?.section);
  const next =
    fields.find((field, fieldIndex) => fieldIndex > Math.max(index, -1) && normalizeText(field.section) !== currentSection) ||
    fields[0];
  focusFieldElement(next?.element);
  return next || null;
}

export function clearFocusedField() {
  if (typeof document === "undefined") return false;
  const active = resolveInteractiveElement(document.activeElement);
  if (!active || isIgnoredNode(active) || !isVisible(active)) return false;
  if (String(active.type || "").toLowerCase() === "checkbox") {
    setNativeChecked(active, false);
    return true;
  }
  if (String(active.type || "").toLowerCase() === "radio") {
    return false;
  }
  if (isNativeField(active)) {
    setNativeValue(active, "");
    return true;
  }
  if (isContentEditableField(active)) {
    setRichTextValue(active, "");
    return true;
  }
  return false;
}

export function appendTextToFocusedField(text) {
  if (typeof document === "undefined") return false;
  const active = resolveInteractiveElement(document.activeElement);
  const nextText = String(text || "").trim();
  if (!active || !nextText || isIgnoredNode(active) || !isVisible(active)) return false;

  if (String(active.type || "").toLowerCase() === "checkbox") {
    setNativeChecked(active, coerceBoolean(nextText));
    return true;
  }

  if (isNativeField(active) && ["INPUT", "TEXTAREA"].includes(active.tagName)) {
    const current = String(active.value || "");
    const start = Number.isInteger(active.selectionStart) ? active.selectionStart : current.length;
    const end = Number.isInteger(active.selectionEnd) ? active.selectionEnd : current.length;
    const glue =
      start > 0 && !/\s$/.test(current.slice(0, start)) && nextText && !/^[,.;:!?)]/.test(nextText)
        ? " "
        : "";
    const value = `${current.slice(0, start)}${glue}${nextText}${current.slice(end)}`;
    setNativeValue(active, value);
    const caret = start + glue.length + nextText.length;
    if (typeof active.setSelectionRange === "function") {
      active.setSelectionRange(caret, caret);
    }
    active.focus?.();
    return true;
  }

  if (isNativeField(active)) {
    const current = String(active.value || "");
    const value = [current, nextText].filter(Boolean).join(current ? " " : "");
    setNativeValue(active, value);
    active.focus?.();
    return true;
  }

  if (isContentEditableField(active)) {
    const current = compactText(active.innerText || active.textContent || "");
    setRichTextValue(active, [current, nextText].filter(Boolean).join(current ? " " : ""));
    return true;
  }

  return false;
}

export function submitFocusedForm() {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  const form = active?.closest?.("form") || document.querySelector("form");
  if (!form) return false;
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
  return true;
}
