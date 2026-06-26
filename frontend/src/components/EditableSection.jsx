import React from "react";

export default function EditableSection({
  title,
  eyebrow = "",
  description = "",
  aside = null,
  className = "",
  saved = false,
  editing = false,
  saving = false,
  message = "",
  saveLabel = "Save Details",
  editLabel = "Edit Details",
  cancelLabel = "Cancel",
  savingLabel = "Saving...",
  onEdit,
  onSave,
  onCancel,
  children,
}) {
  const locked = Boolean(saved && !editing);
  const canCancel = Boolean(editing && saved && typeof onCancel === "function");

  return (
    <section className={`card profile-card editable-section${locked ? " editable-section-locked" : ""} ${className}`.trim()}>
      <div className="card-header-actions">
        <div>
          {eyebrow ? <div className="premium-shell-kicker">{eyebrow}</div> : null}
          {title ? <h3>{title}</h3> : null}
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>

      <fieldset className="editable-section-fields" disabled={locked || saving}>
        {children}
      </fieldset>

      <div className="editable-section-actions">
        {locked ? (
          <button type="button" className="btn-secondary" onClick={onEdit}>
            {editLabel}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
            {saving ? savingLabel : editing ? "Save Changes" : saveLabel}
          </button>
        )}
        {canCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            {cancelLabel}
          </button>
        ) : null}
      </div>

      {message ? <p className="editable-section-message">{message}</p> : null}
    </section>
  );
}
