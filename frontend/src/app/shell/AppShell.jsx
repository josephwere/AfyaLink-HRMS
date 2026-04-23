import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../utils/auth";
import apiFetch from "../../utils/apiFetch";
import { useSystemSettings } from "../../utils/systemSettings.jsx";
import { applyAccessibilityPrefs, loadAccessibilityPrefs } from "../../utils/accessibilityPrefs";
import { useUiPreferences } from "../../utils/uiPreferences";
import { prefetchRoutesForRole } from "../../utils/routePrefetch";
import { refreshOfflineMetricsSnapshot, startOfflineAutoSync } from "../../utils/offlineQueue";
import { pushOfflineClientMetrics } from "../../services/offlineOpsApi";

import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import CommandPalette from "../../components/CommandPalette";
import FirstLoginTour from "../../components/FirstLoginTour";
import MobileTabBar from "../../components/MobileTabBar";
import ContextRail from "./ContextRail";

function readDismissedReminderCache() {
  try {
    const raw = localStorage.getItem("dismissed_reminders");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AppShell() {
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const { uiPreferences, setUiPreferences } = useUiPreferences();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [securityNotice, setSecurityNotice] = useState(null);

  const getOfflineDeviceId = () => {
    const key = "afyalink_offline_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(key, id);
    }
    return id;
  };

  const [dismissed, setDismissed] = useState(() => {
    return readDismissedReminderCache();
  });

  useEffect(() => {
    if (!user) return;
    applyAccessibilityPrefs(loadAccessibilityPrefs(user));
  }, [user]);

  useEffect(() => {
    const profileDismissed = uiPreferences?.navigation?.dismissedReminders;
    if (Array.isArray(profileDismissed)) {
      setDismissed(profileDismissed);
      try {
        localStorage.setItem("dismissed_reminders", JSON.stringify(profileDismissed));
      } catch {
        // ignore local cache failures
      }
      return;
    }

    if (user) {
      setDismissed(readDismissedReminderCache());
    }
  }, [uiPreferences?.navigation?.dismissedReminders, user]);

  useEffect(() => {
    if (!user?.role) return;
    prefetchRoutesForRole(user.role);
  }, [user?.role]);

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
    const postMetrics = async (snapshot) => {
      if (!user) return;
      try {
        await pushOfflineClientMetrics({
          deviceId: getOfflineDeviceId(),
          snapshot: {
            ...(snapshot || refreshOfflineMetricsSnapshot()),
            online: navigator.onLine,
          },
        });
      } catch {
        // swallow telemetry failures
      }
    };

    const stop = startOfflineAutoSync(
      async (item) => {
        await apiFetch(item.path, {
          method: item.method,
          body: item.body,
          _skipOfflineQueue: true,
        });
      },
      {
        onMetrics: (snapshot) => postMetrics(snapshot),
      }
    );
    const onMetricsUpdate = (ev) => postMetrics(ev?.detail || null);
    window.addEventListener("afyalink:offline-metrics-updated", onMetricsUpdate);
    const timer = setInterval(() => postMetrics(), 60000);
    return () => {
      stop?.();
      window.removeEventListener("afyalink:offline-metrics-updated", onMetricsUpdate);
      clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = sidebarOpen || contextOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [contextOpen, sidebarOpen, user]);

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
    if (!user) return;
    apiFetch("/api/auth/session-risk")
      .then((sr) => {
        if (!mounted || !sr) return;
        if (sr.restriction || sr.requiresStepUp) {
          setSecurityNotice({
            code: sr.restriction ? "SESSION_RESTRICTED" : "STEP_UP_REQUIRED",
            message:
              sr.restriction?.reason === "CRITICAL_LOGIN_RISK"
                ? "Your session is temporarily restricted due to critical login risk. Verify step-up to unlock."
                : "Step-up verification is required for sensitive actions.",
          });
          setReminders((prev) => {
            const without = (prev || []).filter((r) => r.id !== "session-stepup");
            return [
              {
                id: "session-stepup",
                text:
                  sr.restriction?.reason === "CRITICAL_LOGIN_RISK"
                    ? "Session restricted. Click to complete step-up verification."
                    : "Sensitive actions require step-up verification. Click to verify.",
                action: () => navigate("/step-up"),
              },
              ...without,
            ];
          });
        } else {
          setSecurityNotice(null);
        }
      })
      .catch(() => {});

    const dashEndpoint = roleDashboardEndpoint(user?.role);
    const dashPromise = dashEndpoint ? apiFetch(dashEndpoint) : Promise.resolve(null);
    Promise.all([apiFetch("/api/profile"), apiFetch("/api/2fa/status"), dashPromise])
      .then(([me, twofa, dash]) => {
        if (!mounted) return;
        const list = [];

        if (!me?.emailVerified) {
          list.push({
            id: "email",
            text:
              me?.verificationWarning?.message ||
              "Your email is not verified. Click to verify in Profile.",
            action: () => navigate("/app/platform/account/profile"),
          });
        }
        if (!me?.phoneVerified) {
          list.push({
            id: "phone",
            text: "Verify your phone number to secure your account.",
            action: () => navigate("/app/platform/account/profile"),
          });
        }
        if (!me?.nationalIdNumber || !me?.nationalIdCountry) {
          list.push({
            id: "id",
            text: "Add your National ID details to complete your profile.",
            action: () => navigate("/app/platform/account/profile"),
          });
        }
        if (!twofa?.enabled) {
          list.push({
            id: "2fa",
            text: "Enable two-factor authentication for stronger security.",
            action: () => navigate("/app/platform/account/profile"),
          });
        }

        if (dash) {
          const role = user?.role;

          if (dash.pendingRequests?.total > 0) {
            list.push({
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
            list.push({
              id: "pending-approvals",
              text: `You have ${dash.pendingRequests} approvals waiting.`,
              action: () => navigate("/app/people/approvals/index"),
            });
          }

          if (role === "HR_MANAGER" && dash.pendingRequests?.total > 0) {
            list.push({
              id: "hr-requests",
              text: `Workforce requests pending: ${dash.pendingRequests.total}.`,
              action: () => navigate("/app/people/home/index"),
            });
          }

          if (role === "PAYROLL_OFFICER" && dash.pendingApprovals > 0) {
            list.push({
              id: "payroll-approvals",
              text: `Payroll approvals pending: ${dash.pendingApprovals}.`,
              action: () => navigate("/app/people/home/index"),
            });
          }

          if (
            (role === "PAYROLL_OFFICER" || role === "HOSPITAL_ADMIN" || role === "SUPER_ADMIN") &&
            dash.overduePayroll > 0
          ) {
            list.push({
              id: "overdue-payroll",
              text: `Overdue payroll items: ${dash.overduePayroll}.`,
              action: () => navigate("/app/revenue/payments/index"),
            });
          }

          if (dash.notificationsUnread > 0) {
            list.push({
              id: "unread-notifs",
              text: `You have ${dash.notificationsUnread} unread notifications.`,
              action: () => navigate("/app/platform/inbox/notifications"),
            });
          }

          if (role === "LAB_TECH" && dash.pendingOrders > 0) {
            list.push({
              id: "lab-orders",
              text: `${dash.pendingOrders} lab orders are pending.`,
              action: () => navigate("/app/operations/lab/test-queue"),
            });
          }

          if (role === "NURSE" && dash.pendingLabOrders > 0) {
            list.push({
              id: "lab-pending",
              text: `${dash.pendingLabOrders} lab orders are pending.`,
              action: () => navigate("/app/operations/lab/test-queue"),
            });
          }

          if (role === "DOCTOR" && dash.upcomingAppointments > 0) {
            list.push({
              id: "doctor-appts",
              text: `${dash.upcomingAppointments} upcoming appointments.`,
              action: () => navigate("/app/operations/scheduling/appointments"),
            });
          }
        }

        setReminders(list);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [navigate, user?.id, user?.role]);

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

  return (
    <>
      {user && (
        <Navbar
          onToggleSidebar={() => {
            setSidebarOpen((v) => !v);
            setContextOpen(false);
          }}
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
        {user && <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

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

          <Outlet />
        </main>

        <ContextRail open={contextOpen} onClose={() => setContextOpen(false)} />
      </div>

      {user && <CommandPalette />}
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
