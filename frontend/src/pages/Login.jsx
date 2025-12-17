import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../utils/auth";
import PasswordInput from "../components/PasswordInput";
import axios from "axios";

export default function Login() {
  const { login, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  /* ---------------------------------------
     Load remembered email
  ---------------------------------------- */
  useEffect(() => {
    const savedEmail = localStorage.getItem("remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  /* ---------------------------------------
     Submit handler
  ---------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (rememberMe) {
        localStorage.setItem("remember_email", email);
      } else {
        localStorage.removeItem("remember_email");
      }

      // 🔐 CALL BACKEND LOGIN
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        { email, password }
      );

      // EXPECTED RESPONSE SHAPE
      // { user: {...}, token: "jwt..." }
      const { user, token } = res.data;

      // ✅ HAND OVER TO AUTH CONTEXT
      login(user, token);
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to AfyaLink HRMS</p>

        {error && <div className="auth-error">{error}</div>}

        <label>Email address</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="auth-row">
          <label className="remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>

          <Link to="/forgot-password" className="forgot-link">
            Forgot password?
          </Link>
        </div>

        <button disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="auth-footer">
          <span>Don’t have an account?</span>
          <Link to="/register">Create account</Link>
        </div>

        <div className="demo-box">
          <strong>Demo users</strong>
          <ul>
            <li>admin@afya.test / adminpass</li>
            <li>dr.asha@afya.test / docpass</li>
            <li>nurse.john@afya.test / nursepass</li>
            <li>mary@afya.test / patientpass</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
