import { useEffect, useRef, useState } from "react";

export default function DismissibleCardSection({
  title,
  defaultOpen = true,
  className = "",
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutsideClick = (event) => {
      if (!sectionRef.current) return;
      if (!sectionRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("touchstart", onOutsideClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("touchstart", onOutsideClick);
    };
  }, [open]);

  if (!open) {
    return (
      <div className="dismissible-collapsed-tile">
        <button
          type="button"
          className="btn-secondary dismissible-toggle-btn"
          onClick={() => setOpen(true)}
        >
          Open {title}
        </button>
      </div>
    );
  }

  return (
    <section ref={sectionRef} className={`dismissible-section ${className}`.trim()}>
      <div className="dismissible-head">
        <h3>{title}</h3>
        <button
          type="button"
          className="btn-secondary dismissible-close-btn"
          onClick={() => setOpen(false)}
          aria-label={`Close ${title}`}
        >
          Close
        </button>
      </div>
      {children}
    </section>
  );
}
