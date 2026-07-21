import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../../contexts/NavigationContext";
import { useUserCapabilitiesInfo } from "../../utils/useCapabilities";
import { useAuth } from "../../utils/auth";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { canonicalizePath } from "../../app/routing/canonicalizePath";
import { getQuickActionsForCapabilities } from "../../config/moduleRegistry";
import "./CommandPalette.css";

/**
 * Command Palette Result Item
 */
function CommandPaletteItem({
  result,
  isSelected,
  onSelect,
  onNavigate,
  category,
}) {
  const { translateText } = useAppLanguage();

  const handleClick = (e) => {
    e.preventDefault();
    onSelect(result);
    onNavigate(result);
  };

  const handleMouseEnter = () => {
    onSelect(result);
  };

  return (
    <li
      className={`command-palette-item${isSelected ? " selected" : ""}`.trim()}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      <div className="command-item-main">
        <span className="command-item-icon">{result.icon || "📄"}</span>
        <div className="command-item-content">
          <div className="command-item-title">{translateText(result.title)}</div>
          {result.description && (
            <div className="command-item-description">
              {translateText(result.description)}
            </div>
          )}
        </div>
      </div>
      {category && (
        <span className="command-item-category">
          {translateText(category)}
        </span>
      )}
    </li>
  );
}

/**
 * Command Palette Component
 * Global search and quick actions with Ctrl+K hotkey
 *
 * Features:
 * - Ctrl+K hotkey activation
 * - Fuzzy search across navigation items, capabilities, quick actions
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Category grouping
 * - Recent searches
 * - Recent items
 * - Quick actions
 *
 * Usage:
 * Place at root level of app, e.g., <App> → <CommandPalette /> <Routes />
 */
export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);

  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const { info: capabilitiesInfo } = useUserCapabilitiesInfo();
  const { search } = useSearch();

  // Get quick actions for user's capabilities
  const quickActions = useMemo(() => {
    const capabilities = capabilitiesInfo?.capabilities || [];
    return getQuickActionsForCapabilities(capabilities);
  }, [capabilitiesInfo?.capabilities]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("commandPalette_recentSearches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Handle Ctrl+K hotkey
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!capabilitiesInfo || !query.trim()) {
      if (!query) {
        return [
          ...quickActions.map((action) => ({
            ...action,
            _category: "Quick Actions",
          })),
          ...recentSearches.slice(0, 3).map((item) => ({
            ...item,
            _category: "Recent Searches",
          })),
        ];
      }

      return [];
    }

    const searchResults = search(query) || [];
    const grouped = {};

    searchResults.forEach((result) => {
      const category = result._category || result.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(result);
    });

    const flatResults = [];
    Object.entries(grouped).forEach(([category, items]) => {
      items.forEach((item) => {
        flatResults.push({ ...item, _category: category });
      });
    });

    return flatResults.slice(0, 20);
  }, [capabilitiesInfo, query, quickActions, recentSearches, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, results.length]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? Math.max(results.length - 1, 0) : prev - 1
        );
        break;

      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          handleNavigate(results[selectedIndex]);
        }
        break;

      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;

      default:
        break;
    }
  };

  // Handle navigation to selected result
  const handleNavigate = useCallback(
    (result) => {
      if (result.route) {
        const path = canonicalizePath(result.route);
        if (path) {
          // Add to recent searches
          const newRecent = [
            { id: result.id, title: result.title, route: result.route, icon: result.icon },
            ...recentSearches.filter((item) => item.id !== result.id),
          ].slice(0, 10);
          setRecentSearches(newRecent);
          localStorage.setItem(
            "commandPalette_recentSearches",
            JSON.stringify(newRecent)
          );

          navigate(path);
          setIsOpen(false);
          setQuery("");
        }
      } else if (result.onClick) {
        // Handle quick actions
        result.onClick();
        setIsOpen(false);
        setQuery("");
      }
    },
    [navigate, recentSearches]
  );

  if (!user) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <div className="command-palette-input-container">
          <span className="command-palette-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder={translateText("Search everything...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
          <button
            className="command-palette-close"
            onClick={() => setIsOpen(false)}
            title={translateText("Close")}
            aria-label={translateText("Close command palette")}
          >
            ✕
          </button>
        </div>

        {/* Results */}
        <div className="command-palette-results">
          {results.length > 0 ? (
            <ul className="command-palette-list">
              {results.map((result, index) => (
                <CommandPaletteItem
                  key={`${result._category}-${result.id}-${index}`}
                  result={result}
                  isSelected={index === selectedIndex}
                  onSelect={() => setSelectedIndex(index)}
                  onNavigate={handleNavigate}
                  category={result._category}
                />
              ))}
            </ul>
          ) : query.trim() ? (
            <div className="command-palette-empty">
              <div className="command-empty-icon">🔍</div>
              <p>{translateText("No results found")}</p>
              <small>{translateText("Try a different search term")}</small>
            </div>
          ) : (
            <div className="command-palette-empty">
              <div className="command-empty-icon">⌘</div>
              <p>{translateText("Start typing to search")}</p>
              <small>{translateText("or use arrow keys to navigate")}</small>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="command-palette-footer">
          <div className="command-footer-shortcuts">
            <span className="command-shortcut">
              <kbd>↑↓</kbd>
              {translateText("Navigate")}
            </span>
            <span className="command-shortcut">
              <kbd>Enter</kbd>
              {translateText("Select")}
            </span>
            <span className="command-shortcut">
              <kbd>Esc</kbd>
              {translateText("Close")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
