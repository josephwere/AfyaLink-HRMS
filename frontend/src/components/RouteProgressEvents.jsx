import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Emits start/done events for route transitions so the global progress bar
// feels responsive even before network requests begin.
export default function RouteProgressEvents() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let finished = false;

    window.dispatchEvent(new CustomEvent("afyalink:progress:start", { detail: { source: "route" } }));

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      window.dispatchEvent(new CustomEvent("afyalink:progress:done", { detail: { source: "route" } }));
    }, 650);

    return () => {
      clearTimeout(timer);
      if (!finished) {
        finished = true;
        window.dispatchEvent(new CustomEvent("afyalink:progress:done", { detail: { source: "route" } }));
      }
    };
  }, [location.key]);

  return null;
}

