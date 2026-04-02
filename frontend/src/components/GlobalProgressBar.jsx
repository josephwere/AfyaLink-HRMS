import React, { useEffect, useRef, useState } from "react";

// Lightweight "progress bar illusion" similar to modern SaaS apps.
// Driven by `window` events so it can react to route changes + apiFetch without tight coupling.
export default function GlobalProgressBar() {
  const inFlightRef = useRef(0);
  const trickleTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [pct, setPct] = useState(0);

  const clearTimers = () => {
    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current);
      trickleTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const start = () => {
    inFlightRef.current += 1;
    if (inFlightRef.current !== 1) return;

    clearTimers();
    setVisible(true);
    setPct((prev) => (prev > 0 && prev < 90 ? prev : 12));

    trickleTimerRef.current = setInterval(() => {
      setPct((prev) => {
        if (prev >= 90) return prev;
        const remaining = Math.max(0, 100 - prev);
        const step = Math.max(0.8, Math.min(6, remaining * 0.06));
        const jitter = Math.random() * 1.4;
        return Math.min(90, prev + step + jitter);
      });
    }, 420);
  };

  const done = () => {
    inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    if (inFlightRef.current !== 0) return;

    clearTimers();
    setPct(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setPct(0);
    }, 240);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStart = () => start();
    const onDone = () => done();

    window.addEventListener("afyalink:progress:start", onStart);
    window.addEventListener("afyalink:progress:done", onDone);

    return () => {
      window.removeEventListener("afyalink:progress:start", onStart);
      window.removeEventListener("afyalink:progress:done", onDone);
      clearTimers();
    };
  }, []);

  return (
    <div className={`afya-progress${visible ? " is-visible" : ""}`} aria-hidden="true">
      <div className="afya-progress-bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

