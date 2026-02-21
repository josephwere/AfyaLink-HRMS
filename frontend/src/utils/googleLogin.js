import apiFetch from "./apiFetch.js";
import { redirectByRole } from "./redirectByRole.js";

export const handleGoogleLogin = async (credential) => {
  try {
    // Send Google token to backend
    const res = await apiFetch("/api/auth/google", {
      method: "POST",
      body: { credential },
    });

    const { user, accessToken, refreshToken } = res;

    if (!user) {
      console.error("No user returned from backend");
      return;
    }

    // Save user + token in localStorage
    localStorage.setItem("token", accessToken);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
    localStorage.setItem("user", JSON.stringify(user));

    // Redirect to correct dashboard
    const landingPage = redirectByRole(user);
    window.location.href = landingPage;

  } catch (err) {
    console.error("Google login failed:", err.message);
    alert("Login failed. Please try again.");
  }
};
