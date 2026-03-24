import { useAppLanguage } from "../utils/appLanguage.jsx";

export default function LanguageSwitcher({ compact = false, className = "" }) {
  const { allowLanguageSwitch, language, options, setLanguage, t } = useAppLanguage();

  if (!allowLanguageSwitch) return null;

  return (
    <label
      className={`language-switcher${compact ? " compact" : ""}${className ? ` ${className}` : ""}`.trim()}
      data-i18n-ignore="true"
    >
      <span className="language-switcher-label">{t("languageLabel", "Language")}</span>
      <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t("languageMenuTitle", "App language")}>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
