import React, { startTransition, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../utils/auth";
import apiFetch from "../../utils/apiFetch";
import { useSystemSettings } from "../../utils/systemSettings.jsx";
import { applyAccessibilityPrefs, loadAccessibilityPrefs } from "../../utils/accessibilityPrefs";
import { useUiPreferences } from "../../utils/uiPreferences";
import { prefetchRoutesForRole } from "../../utils/routePrefetch";
import { refreshOfflineMetricsSnapshot, startOfflineAutoSync } from "../../utils/offlineQueue";
import { pushOfflineClientMetrics } from "../../services/offlineOpsApi";
import { getBrowserRegionDefaults } from "../../utils/locale";

import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Navigation/Sidebar";
import QuickActions from "../../components/Navigation/QuickActions";
import FirstLoginTour from "../../components/FirstLoginTour";
import MobileTabBar from "../../components/MobileTabBar";
import ContextRail from "./ContextRail";
import { isDashboardRoute } from "../../utils/dashboardShellUtils";
import { useUserContext } from "../../contexts/UserContextContext";
import { getContextRedirectPath } from "../../contexts/contextRouteRules";

function readDismissedReminderCache() {
  try {
    const raw = localStorage.getItem("dismissed_reminders");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeDismissedReminderIds(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter(Boolean)));
}

function scheduleBackgroundTask(task) {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    return {
      type: "idle",
      id: window.requestIdleCallback(task, { timeout: 700 }),
    };
  }

  return {
    type: "timeout",
    id: window.setTimeout(task, 80),
  };
}

function cancelBackgroundTask(handle) {
  if (!handle) return;
  if (handle.type === "idle" && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle.id);
    return;
  }
  window.clearTimeout(handle.id);
}

function pushReminder(list, reminder) {
  if (!reminder?.id || list.some((item) => item.id === reminder.id)) return;
  list.push(reminder);
}

function mergeReminderSets(nextList = [], previousList = []) {
  const merged = [];
  const sticky = (previousList || []).filter((item) => item?.id === "session-stepup");
  sticky.forEach((item) => pushReminder(merged, item));
  (nextList || []).forEach((item) => pushReminder(merged, item));
  return merged;
}

function buildProfileReminders(profile, navigate) {
  const list = [];

  if (!profile?.emailVerified) {
    pushReminder(list, {
      id: "email",
      text:
        profile?.verificationWarning?.message ||
        "Your email is not verified. Click to verify in Profile.",
      action: () => navigate("/app/platform/account/profile"),
    });
  }

  if (!profile?.phoneVerified) {
    pushReminder(list, {
      id: "phone",
      text: "Verify your phone number to secure your account.",
      action: () => navigate("/app/platform/account/profile"),
    });
  }

  if (!profile?.nationalIdNumber || !profile?.nationalIdCountry) {
    pushReminder(list, {
      id: "id",
      text: "Add your National ID details to complete your profile.",
      action: () => navigate("/app/platform/account/profile"),
    });
  }

  return list;
}

function appendDashboardReminders(list, dash, role, navigate) {
  if (!dash) return list;

  if (dash.pendingRequests?.total > 0) {
    pushReminder(list, {
      id: "pending-requests",
      text: `You have ${dash.pendingRequests.total} pending requests.`,
      action: () =>
        navigate(
          role === "HOSPITAL_ADMIN"
            ? "/app/people/approvals/index"
            : "/app/people/requests/index"
        ),
    });
  }

  if (role === "HOSPITAL_ADMIN" && dash.pendingRequests > 0) {
    pushReminder(list, {
      id: "pending-approvals",
      text: `You have ${dash.pendingRequests} approvals waiting.`,
      action: () => navigate("/app/people/approvals/index"),
    });
  }

  if (role === "HR_MANAGER" && dash.pendingRequests?.total > 0) {
    pushReminder(list, {
      id: "hr-requests",
      text: `Workforce requests pending: ${dash.pendingRequests.total}.`,
      action: () => navigate("/app/people/home/index"),
    });
  }

  if (role === "PAYROLL_OFFICER" && dash.pendingApprovals > 0) {
    pushReminder(list, {
      id: "payroll-approvals",
      text: `Payroll approvals pending: ${dash.pendingApprovals}.`,
      action: () => navigate("/app/people/home/index"),
    });
  }

  if (
    (role === "PAYROLL_OFFICER" || role === "HOSPITAL_ADMIN" || role === "SUPER_ADMIN") &&
    dash.overduePayroll > 0
  ) {
    pushReminder(list, {
      id: "overdue-payroll",
      text: `Overdue payroll items: ${dash.overduePayroll}.`,
      action: () => navigate("/app/revenue/payments/index"),
    });
  }

  if (dash.notificationsUnread > 0) {
    pushReminder(list, {
      id: "unread-notifs",
      text: `You have ${dash.notificationsUnread} unread notifications.`,
      action: () => navigate("/app/platform/inbox/notifications"),
    });
  }

  if (role === "LAB_TECH" && dash.pendingOrders > 0) {
    pushReminder(list, {
      id: "lab-orders",
      text: `${dash.pendingOrders} lab orders are pending.`,
      action: () => navigate("/app/operations/lab/test-queue"),
    });
  }

  if (role === "NURSE" && dash.pendingLabOrders > 0) {
    pushReminder(list, {
      id: "lab-pending",
      text: `${dash.pendingLabOrders} lab orders are pending.`,
      action: () => navigate("/app/operations/lab/test-queue"),
    });
  }

  if (role === "DOCTOR" && dash.upcomingAppointments > 0) {
    pushReminder(list, {
      id: "doctor-appts",
      text: `${dash.upcomingAppointments} upcoming appointments.`,
      action: () => navigate("/app/operations/scheduling/appointments"),
    });
  }

  return list;
}

const OFFLINE_METRICS_HEARTBEAT_MS = 5 * 60 * 1000;
const OFFLINE_METRICS_BASE_BACKOFF_MS = 15 * 1000;
const OFFLINE_METRICS_MAX_BACKOFF_MS = 5 * 60 * 1000;

function buildOfflineMetricsSignature({ deviceId, userId, snapshot }) {
  return JSON.stringify({
    deviceId: String(deviceId || ""),
    userId: String(userId || ""),
    queueLength: Number(snapshot?.queueLength || 0),
    pendingByModule: snapshot?.pendingByModule || {},
    lifetime: snapshot?.lifetime || {},
    lastEnqueueAt: snapshot?.lastEnqueueAt || null,
    lastSyncAt: snapshot?.lastSyncAt || null,
    lastFailureAt: snapshot?.lastFailureAt || null,
    online: snapshot?.online !== false,
  });
}

// Returns user's stored sidebar preference, or null if never set
function readStoredSidebarPreference(userId) {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const key = `afyalink_sidebar_preference_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored === "open" || stored === "closed") return stored === "open";
    return null;
  } catch {
    return null;
  }
}

// Persist sidebar preference only after user manually changes it
function writeSidebarPreference(userId, isOpen) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const key = `afyalink_sidebar_preference_${userId}`;
    localStorage.setItem(key, isOpen ? "open" : "closed");
  } catch {
    // Ignore storage quota failures
  }
}

export default function AppShell() {
  const { user, actualRole, roleOverride, setRoleOverride } = useAuth();
  const location = useLocation();
  const { settings } = useSystemSettings();
  const { uiPreferences, setUiPreferences, flushUiPreferences } = useUiPreferences();
  const navigate = useNavigate();
  const { mode } = useUserContext();
  const userHasManuallyChangedSidebarRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return false;
  });
  const [contextOpen, setContextOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [securityNotice, setSecurityNotice] = useState(null);
  const bootstrapPrefsPendingRef = useRef(false);
  const offlineDeviceIdRef = useRef("");
  const userId = user?.id || user?._id || user?.email || "";
  const userRole = user?.role || "";
  const userOnlineMode = Boolean(user && !user?.offlineSession);
  const hasUser = Boolean(userId);
  const userUiPreferences = user?.uiPreferences || {};
  const offlineMetricsStateRef = useRef({
    inFlight: false,
    lastSignature: "",
    lastSentAt: 0,
    failureCount: 0,
    pendingSnapshot: null,
    retryTimerId: null,
  });

  const getOfflineDeviceId = () => {
    if (offlineDeviceIdRef.current) return offlineDeviceIdRef.current;
    const key = "afyalink_offline_device_id";
    let id = "";
    try {
      if (typeof localStorage?.getItem === "function") {
        id = localStorage.getItem(key) || "";
      }
    } catch {
      id = "";
    }
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      try {
        if (typeof localStorage?.setItem === "function") {
          localStorage.setItem(key, id);
        }
      } catch {
        // Storage can be blocked in private browsing or embedded webviews.
      }
    }
    offlineDeviceIdRef.current = id;
    return id;
  };

  const [dismissed, setDismissed] = useState(() => {
    return readDismissedReminderCache();
  });

  useEffect(() => {
    if (!hasUser) return;
    applyAccessibilityPrefs(loadAccessibilityPrefs(user));
  }, [hasUser, userId]);

  useEffect(() => {
    if (!hasUser) return;
    const defaults = getBrowserRegionDefaults();
    const currentPrefs = userUiPreferences || {};
    const patch = {};

    if (!currentPrefs.locale) patch.locale = defaults.locale;
    if (!currentPrefs.appLanguage) patch.appLanguage = defaults.appLanguage;
    if (!currentPrefs.patientLanguage) patch.patientLanguage = defaults.patientLanguage;
    if (!currentPrefs.timeZone) patch.timeZone = defaults.timeZone;
    if (!currentPrefs.currency) patch.currency = defaults.currency;

    if (Object.keys(patch).length) {
      bootstrapPrefsPendingRef.current = true;
      setUiPreferences(patch, { persist: false });
    }
  }, [
    hasUser,
    setUiPreferences,
    userId,
    userUiPreferences?.appLanguage,
    userUiPreferences?.currency,
    userUiPreferences?.locale,
    userUiPreferences?.patientLanguage,
    userUiPreferences?.timeZone,
  ]);

  useEffect(() => {
    if (!hasUser) return;

    const profileDismissed = normalizeDismissedReminderIds(
      uiPreferences?.navigation?.dismissedReminders
    );
    const nextDismissed = normalizeDismissedReminderIds(
      profileDismissed.length ? profileDismissed : readDismissedReminderCache()
    );

    setDismissed((current) => {
      const currentDismissed = normalizeDismissedReminderIds(current);
      if (
        currentDismissed.length === nextDismissed.length &&
        currentDismissed.every((value, index) => value === nextDismissed[index])
      ) {
        return current;
      }

      try {
        localStorage.setItem("dismissed_reminders", JSON.stringify(nextDismissed));
      } catch {
        // ignore local cache failures
      }
      return nextDismissed;
    });
  }, [hasUser, uiPreferences?.navigation?.dismissedReminders, userId]);

  useEffect(() => {
    if (!userRole) return;
    prefetchRoutesForRole(userRole);
  }, [userRole]);

  const roleDashboardEndpoint = (role) => {
    switch (role) {
      case "DOCTOR":
        return "/api/dashboard/doctor";
      case "NURSE":
        return "/api/dashboard/nurse";
      case "LAB_TECH":
        return "/api/dashboard/lab-tech";
      case "HR_MANAGER":
        return "/api/dashboard/hr";
      case "PAYROLL_OFFICER":
        return "/api/dashboard/payroll";
      case "HOSPITAL_ADMIN":
      case "HOSPITAL_ADMIN_ASSISTANT":
        return "/api/dashboard/hospital-admin";
      case "SECURITY_ADMIN":
        return "/api/dashboard/security-admin";
      case "SECURITY_OFFICER":
        return "/api/dashboard/security-officer";
      case "PATIENT":
        return "/api/dashboard/patient";
      case "COMMUNITY_HEALTH_WORKER":
        return "/api/dashboard/community-health-worker";
      case "SUPER_ADMIN":
        return "/api/dashboard/super-admin";
      case "RADIOLOGIST":
        return "/api/dashboard/radiologist";
      case "THERAPIST":
        return "/api/dashboard/therapist";
      case "RECEPTIONIST":
        return "/api/dashboard/receptionist";
      case "SURGEON":
        return "/api/dashboard/surgeon";
      default:
        return null;
    }
  };

  useEffect(() => {
    if (!userId) return undefined;

    let disposed = false;
    const syncState = offlineMetricsStateRef.current;
    syncState.inFlight = false;
    syncState.lastSignature = "";
    syncState.lastSentAt = 0;
    syncState.failureCount = 0;
    syncState.pendingSnapshot = null;

    const clearRetryTimer = () => {
      if (!syncState.retryTimerId) return;
      window.clearTimeout(syncState.retryTimerId);
      syncState.retryTimerId = null;
    };

    const scheduleRetry = (delayMs, postMetrics) => {
      if (disposed || syncState.retryTimerId) return;
      syncState.retryTimerId = window.setTimeout(() => {
        syncState.retryTimerId = null;
        if (disposed || !syncState.pendingSnapshot) return;
        const snapshot = syncState.pendingSnapshot;
        syncState.pendingSnapshot = null;
        void postMetrics(snapshot);
      }, delayMs);
    };

    const postMetrics = async (snapshot) => {
      if (disposed) return;

      const nextSnapshot = {
        ...(snapshot || refreshOfflineMetricsSnapshot({ emit: false })),
        online: navigator.onLine,
      };
      const deviceId = getOfflineDeviceId();
      const signature = buildOfflineMetricsSignature({
        deviceId,
        userId,
        snapshot: nextSnapshot,
      });
      const now = Date.now();
      const heartbeatDue = now - syncState.lastSentAt >= OFFLINE_METRICS_HEARTBEAT_MS;

      if (!heartbeatDue && signature === syncState.lastSignature) {
        return;
      }

      if (syncState.inFlight) {
        syncState.pendingSnapshot = nextSnapshot;
        return;
      }

      syncState.inFlight = true;
      try {
        await pushOfflineClientMetrics({
          deviceId,
          snapshot: nextSnapshot,
        });
        syncState.lastSignature = signature;
        syncState.lastSentAt = Date.now();
        syncState.failureCount = 0;
        syncState.pendingSnapshot = null;
        clearRetryTimer();
      } catch {
        syncState.failureCount += 1;
        syncState.pendingSnapshot = nextSnapshot;
        const backoffMs = Math.min(
          OFFLINE_METRICS_MAX_BACKOFF_MS,
          OFFLINE_METRICS_BASE_BACKOFF_MS * 2 ** (syncState.failureCount - 1)
        );
        scheduleRetry(backoffMs, postMetrics);
      } finally {
        syncState.inFlight = false;
        if (disposed || syncState.retryTimerId || !syncState.pendingSnapshot) return;
        if (syncState.pendingSnapshot !== nextSnapshot) {
          const pending = syncState.pendingSnapshot;
          syncState.pendingSnapshot = null;
          void postMetrics(pending);
        }
      }
    };

    const stop = startOfflineAutoSync(
      async (item) => {
        await apiFetch(item.path, {
          method: item.method,
          body: item.body,
          _skipOfflineQueue: true,
        });
      }
    );
    const onMetricsUpdate = (ev) => {
      void postMetrics(ev?.detail || null);
    };
    window.addEventListener("afyalink:offline-metrics-updated", onMetricsUpdate);
    void postMetrics(refreshOfflineMetricsSnapshot({ emit: false }));
    const timer = setInterval(() => {
      void postMetrics();
    }, OFFLINE_METRICS_HEARTBEAT_MS);
    return () => {
      disposed = true;
      stop?.();
      window.removeEventListener("afyalink:offline-metrics-updated", onMetricsUpdate);
      clearInterval(timer);
      clearRetryTimer();
    };
  }, [userId]);

  useEffect(() => {
    if (!hasUser) return;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = sidebarOpen || contextOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [contextOpen, hasUser, sidebarOpen]);

  useEffect(() => {
    const onSecurity = (event) => {
      const detail = event?.detail || {};
      setSecurityNotice({
        code: detail.code || "SESSION_SECURITY",
        message: detail.message || "Additional verification is required.",
      });
      navigate("/step-up");
    };
    window.addEventListener("afyalink:session-security", onSecurity);
    return () => {
      window.removeEventListener("afyalink:session-security", onSecurity);
    };
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    if (!hasUser) return;
    setReminders((prev) => mergeReminderSets(buildProfileReminders(user, navigate), prev));

    const backgroundTask = scheduleBackgroundTask(async () => {
      const sessionUserResult = await apiFetch("/api/auth/me", {
        _skipUiProgress: true,
        cacheTtlMs: 15000,
      }).catch(() => null);
      if (sessionUserResult && bootstrapPrefsPendingRef.current && userOnlineMode) {
        const flushed = await flushUiPreferences(undefined, {
          keepalive: true,
          timeoutMs: 4000,
        }).catch(() => false);
        if (flushed) {
          bootstrapPrefsPendingRef.current = false;
        }
      }
      const dashEndpoint = roleDashboardEndpoint(userRole);
      const [sessionRiskResult, twofaResult, dashboardResult] = await Promise.allSettled([
        apiFetch("/api/auth/session-risk", { _skipUiProgress: true, cacheTtlMs: 10000 }),
        apiFetch("/api/2fa/status", { _skipUiProgress: true, cacheTtlMs: 15000 }),
        dashEndpoint
          ? apiFetch(dashEndpoint, { _skipUiProgress: true, cacheTtlMs: 15000 })
          : Promise.resolve(null),
      ]);

      if (!mounted) return;

      const profile = sessionUserResult || user;
      const sessionRisk =
        sessionRiskResult.status === "fulfilled" ? sessionRiskResult.value : null;
      const twofa = twofaResult.status === "fulfilled" ? twofaResult.value : null;
      const dash = dashboardResult.status === "fulfilled" ? dashboardResult.value : null;

      const nextList = appendDashboardReminders(
        buildProfileReminders(profile, navigate),
        dash,
        userRole,
        navigate
      );

      if (twofa && !twofa.enabled) {
        pushReminder(nextList, {
          id: "2fa",
          text: "Enable two-factor authentication for stronger security.",
          action: () => navigate("/app/platform/account/profile"),
        });
      }

      if (sessionRisk?.restriction || sessionRisk?.requiresStepUp) {
        setSecurityNotice({
          code: sessionRisk.restriction ? "SESSION_RESTRICTED" : "STEP_UP_REQUIRED",
          message:
            sessionRisk.restriction?.reason === "CRITICAL_LOGIN_RISK"
              ? "Your session is temporarily restricted due to critical login risk. Verify step-up to unlock."
              : "Step-up verification is required for sensitive actions.",
        });
        nextList.unshift({
          id: "session-stepup",
          text:
            sessionRisk.restriction?.reason === "CRITICAL_LOGIN_RISK"
              ? "Session restricted. Click to complete step-up verification."
              : "Sensitive actions require step-up verification. Click to verify.",
          action: () => navigate("/step-up"),
        });
      } else {
        setSecurityNotice(null);
      }

      startTransition(() => {
        setReminders((prev) => mergeReminderSets(nextList, prev));
      });
    });

    return () => {
      mounted = false;
      cancelBackgroundTask(backgroundTask);
    };
  }, [flushUiPreferences, hasUser, navigate, userId, userOnlineMode, userRole]);

  const dismissReminder = (id) => {
    const next = Array.from(new Set([...(dismissed || []), id]));
    setDismissed(next);
    localStorage.setItem("dismissed_reminders", JSON.stringify(next));
    if (user) {
      setUiPreferences(
        {
          navigation: {
            dismissedReminders: next,
          },
        },
        { immediate: true }
      );
    }
  };

  const handleToggleSidebar = () => {
    setSidebarOpen((v) => {
      const nextState = !v;
      // Only persist preference after user manually changes it
      userHasManuallyChangedSidebarRef.current = true;
      if (userId) {
        writeSidebarPreference(userId, nextState);
      }
      return nextState;
    });
    setContextOpen(false);
  };

  const handleSidebarItemClick = () => {
    // On mobile, automatically close sidebar when a menu item is selected
    if (window.matchMedia("(max-width: 900px)").matches) {
      setSidebarOpen(false);
    }
  };

  const redirectPath = getContextRedirectPath(location.pathname, mode, user);
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <>
      {user && (
        <Navbar
          onToggleSidebar={handleToggleSidebar}
          onToggleContextRail={() => {
            setContextOpen((v) => !v);
            setSidebarOpen(false);
          }}
          contextOpen={contextOpen}
        />
      )}
      {user && sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigator"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {user && contextOpen && (
        <button
          className="context-backdrop"
          aria-label="Close context panel"
          onClick={() => setContextOpen(false)}
        />
      )}

      <div
        className={`app-grid ${sidebarOpen ? "" : "sidebar-collapsed"} ${contextOpen ? "" : "context-collapsed"}`.trim()}
      >
        {user && <Sidebar currentPath={location.pathname} compact={!sidebarOpen} onItemClick={handleSidebarItemClick} />}

        <main className="main">
          {securityNotice && (
            <button type="button" className="verify-banner" onClick={() => navigate("/step-up")}>
              {securityNotice.message}
              <span
                className="banner-close"
                role="button"
                aria-label="Dismiss notice"
                onClick={(e) => {
                  e.stopPropagation();
                  setSecurityNotice(null);
                }}
              >
                ×
              </span>
            </button>
          )}

          {reminders
            .filter((r) => !dismissed.includes(r.id))
            .map((r) => (
              <button
                type="button"
                key={r.id}
                className="verify-banner"
                onClick={r.action}
              >
                {r.text}
                <span
                  className="banner-close"
                  role="button"
                  aria-label="Dismiss reminder"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissReminder(r.id);
                  }}
                >
                  ×
                </span>
              </button>
            ))}

          {!isDashboardRoute(location.pathname) ? <QuickActions className="app-shell-navigation-quick-actions" /> : null}
          <Outlet />
        </main>

        <ContextRail open={contextOpen} onClose={() => setContextOpen(false)} />
      </div>
      {user && <FirstLoginTour />}
      {user && (
        <MobileTabBar
          user={user}
          onOpenMore={() => {
            setSidebarOpen((value) => !value);
            setContextOpen(false);
          }}
        />
      )}
    </>
  );
}
