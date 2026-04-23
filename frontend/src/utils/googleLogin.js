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
    window.location.href = landingPage;

  } catch (err) {
    console.error("Google login failed:", err.message);
    alert("Login failed. Please try again.");
  }
};
