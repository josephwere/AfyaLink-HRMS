import React from "react";
import { usePatientLanguage } from "../utils/patientLanguage.jsx";

export default function PatientLanguageBar({ title = "", subtitle = "", actions = null }) {
  const {
    language,
    t,
    options,
    whatsappSupport,
    voiceFirstIntake,
    helpLine,
  } = usePatientLanguage();

  return (
    <div className="patient-language-bar card premium-card">
      <div className="patient-language-copy">
        {title ? <div className="patient-language-kicker">{title}</div> : null}
        {subtitle ? <p className="muted">{subtitle}</p> : null}
        <div className="patient-language-chips">
          <span className="action-pill">{t("languageLabel", "Language")}: {options.find((item) => item.code === language)?.label || language.toUpperCase()}</span>
          {voiceFirstIntake ? <span className="action-pill">Voice-first intake</span> : null}
          {whatsappSupport ? <span className="action-pill">WhatsApp enabled</span> : null}
          {helpLine ? <span className="action-pill">Help line: {helpLine}</span> : null}
        </div>
      </div>

      <div className="patient-language-controls">
        {actions ? <div className="patient-language-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
