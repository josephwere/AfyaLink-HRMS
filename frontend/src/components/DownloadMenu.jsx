import { useEffect, useRef, useState } from "react";

export default function DownloadMenu({
  label = "Download",
  disabled = false,
  options = [],
  className = "btn-secondary",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="download-menu" ref={rootRef}>
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && !disabled ? (
        <div className="download-menu-list">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="btn-secondary download-menu-copy"
              onClick={() => {
                setOpen(false);
                option.onClick?.();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
