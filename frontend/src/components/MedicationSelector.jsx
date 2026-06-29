import React, { useEffect, useMemo, useRef, useState } from "react";

const RECENT_STORAGE_KEY = "afyalink.medicationSelector.recent";
const FREQUENT_STORAGE_KEY = "afyalink.medicationSelector.frequent";
const RECENT_LIMIT = 8;
const FREQUENT_LIMIT = 6;

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatMedicationLabel(item) {
  const parts = [];
  if (item?.name) parts.push(item.name);
  if (item?.strength) parts.push(item.strength);
  if (item?.form) parts.push(item.form);
  return parts.join(" ");
}

function getStockMeta(item) {
  const quantity = item?.totalQuantity ?? item?.availableQuantity ?? 0;
  const unit = item?.unit || "units";
  if (item?.stockStatus === "OUT_OF_STOCK") {
    return { text: `Out of stock • ${quantity} ${unit}`, tone: "danger" };
  }
  if (item?.stockStatus === "LOW_STOCK") {
    return { text: `Low stock • ${quantity} ${unit}`, tone: "warning" };
  }
  return { text: `In stock • ${quantity} ${unit}`, tone: "success" };
}

function readStorageList(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStorageList(key, values) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(values));
}

export default function MedicationSelector({ options = [], value = "", onSelect, placeholder = "Search medications", disabled = false }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState([]);
  const [frequentMap, setFrequentMap] = useState({});
  const inputRef = useRef(null);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    return options.find((item) => String(item._id) === String(value)) || null;
  }, [options, value]);

  useEffect(() => {
    setRecentIds(readStorageList(RECENT_STORAGE_KEY));
    setFrequentMap(readStorageList(FREQUENT_STORAGE_KEY).reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {}));
  }, []);

  useEffect(() => {
    if (selectedOption) {
      setQuery(formatMedicationLabel(selectedOption));
    } else if (!value) {
      setQuery("");
    }
  }, [selectedOption, value]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filteredOptions = useMemo(() => {
    const search = normalizeText(debouncedQuery);
    const baseOptions = options.filter((item) => {
      const haystack = [item?.name, item?.strength, item?.form, item?.sku, item?.category, item?.genericName, item?.unit]
        .filter(Boolean)
        .join(" ");
      return !search || normalizeText(haystack).includes(search);
    });

    if (!search) {
      return baseOptions.slice(0, 10);
    }
    return baseOptions;
  }, [options, debouncedQuery]);

  const recentOptions = useMemo(() => {
    return options.filter((item) => recentIds.includes(String(item._id))).slice(0, RECENT_LIMIT);
  }, [options, recentIds]);

  const frequentOptions = useMemo(() => {
    return options
      .filter((item) => Object.prototype.hasOwnProperty.call(frequentMap, String(item._id)))
      .sort((a, b) => (frequentMap[String(b._id)] || 0) - (frequentMap[String(a._id)] || 0))
      .slice(0, FREQUENT_LIMIT);
  }, [options, frequentMap]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedQuery]);

  const handleSelect = (option) => {
    const optionId = String(option._id);
    const nextRecent = [optionId, ...recentIds.filter((id) => id !== optionId)].slice(0, RECENT_LIMIT);
    const nextFrequent = {
      ...frequentMap,
      [optionId]: (frequentMap[optionId] || 0) + 1,
    };
    setRecentIds(nextRecent);
    setFrequentMap(nextFrequent);
    writeStorageList(RECENT_STORAGE_KEY, nextRecent);
    writeStorageList(FREQUENT_STORAGE_KEY, Object.entries(nextFrequent).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, FREQUENT_LIMIT));
    setQuery(formatMedicationLabel(option));
    setIsOpen(false);
    if (typeof onSelect === "function") {
      onSelect(option._id, option);
    }
  };

  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
    if (typeof onSelect === "function") {
      onSelect("");
    }
  };

  const visibleOptions = useMemo(() => {
    const list = [];
    if (!debouncedQuery.trim()) {
      if (recentOptions.length) {
        list.push({ key: "recent", title: "Recent", options: recentOptions });
      }
      if (frequentOptions.length) {
        list.push({ key: "frequent", title: "Frequently used", options: frequentOptions });
      }
      if (filteredOptions.length) {
        list.push({ key: "results", title: "Search results", options: filteredOptions });
      }
      return list;
    }
    return [{ key: "results", title: "Search results", options: filteredOptions }];
  }, [debouncedQuery, filteredOptions, frequentOptions, recentOptions]);

  const handleKeyDown = (event) => {
    if (!isOpen || !visibleOptions.length) return;
    const flattened = visibleOptions.flatMap((group) => group.options);
    if (!flattened.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % flattened.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + flattened.length) % flattened.length);
    } else if (event.key === "Enter") {
      const activeOption = flattened[highlightedIndex];
      if (activeOption) {
        event.preventDefault();
        handleSelect(activeOption);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{ width: "100%", minWidth: 0 }}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="medication-selector-options"
        />
        {value ? (
          <button type="button" className="btn-secondary" onClick={handleClear} style={{ whiteSpace: "nowrap" }}>
            Clear
          </button>
        ) : null}
      </div>

      {selectedOption ? (
        <div className="action-pill" style={{ marginTop: 6 }}>
          Selected: {formatMedicationLabel(selectedOption)}
        </div>
      ) : null}

      {isOpen && visibleOptions.length ? (
        <div
          id="medication-selector-options"
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 40,
            left: 0,
            right: 0,
            marginTop: 4,
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
            overflow: "hidden",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {visibleOptions.map((group) => (
            <div key={group.key}>
              <div style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "#475569", background: "#f8fafc" }}>
                {group.title}
              </div>
              {group.options.map((option, optionIndex) => {
                const stock = getStockMeta(option);
                const flattenedIndex = visibleOptions.slice(0, visibleOptions.findIndex((item) => item.key === group.key)).reduce((sum, item) => sum + item.options.length, 0) + optionIndex;
                return (
                  <button
                    key={option._id}
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(option)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: highlightedIndex === flattenedIndex ? "#eff6ff" : value === String(option._id) ? "#eef2ff" : "#fff",
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{formatMedicationLabel(option)}</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                      {option?.strength || option?.form ? `${option?.strength || ""}${option?.strength && option?.form ? " • " : ""}${option?.form || ""}` : "Inventory item"}
                      {option?.sku ? ` • SKU ${option.sku}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: stock.tone === "danger" ? "#b91c1c" : stock.tone === "warning" ? "#b45309" : "#166534", marginTop: 2 }}>
                      {stock.text}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      {isOpen && !visibleOptions.length ? (
        <div style={{ position: "absolute", zIndex: 30, left: 0, right: 0, marginTop: 4, background: "#fff", border: "1px solid #d0d7de", borderRadius: 8, padding: "10px 12px", color: "#64748b" }}>
          No matching medications found.
        </div>
      ) : null}
    </div>
  );
}
