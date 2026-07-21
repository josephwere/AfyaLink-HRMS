import apiFetch from "./apiFetch.js";
import { setAccessToken, writeStoredUser } from "./browserSession.js";
import { redirectByRole } from "./redirectByRole.js";

export const handleGoogleLogin = async (credential) => {
  try {
    // Send Google token to backend
    const res = await apiFetch("/api/auth/google", {
      method: "POST",
      body: { credential },
    });

    const { user, accessToken } = res;

    if (!user) {
      console.error("No user returned from backend");
      return;
    }

    setAccessToken(accessToken);
    writeStoredUser(user);

    // Redirect to correct dashboard
    const landingPage = redirectByRole(user);
    return { user, landingPage };

  } catch (err) {
    console.error("Google login failed:", err.message);
    alert("Login failed. Please try again.");
    return null;
  }
};

/**
 * Initialize Google Sign-In once. Multiple calls are safe and will only initialize once.
 */
export function initGoogleSignIn({ clientId, callback, autoSelect = false } = {}) {
  try {
    if (typeof window === "undefined") return false;
    if (window.__afyalink_google_initialized) return true;
    window.__afyalink_google_initialized = true;
    // Defer initialize until the GSI library is available
    const doInit = () => {
      try {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback, auto_select: !!autoSelect });
      } catch (e) {
        // ignore errors during init
      }
    };
    if (window.google && window.google.accounts && window.google.accounts.id) {
      doInit();
    } else {
      // Listen once for the library to load
      const onLoad = () => {
        doInit();
        window.removeEventListener('gsi-loaded', onLoad);
      };
      window.addEventListener('gsi-loaded', onLoad);
    }
    return true;
  } catch (e) {
    return false;
  }
}
