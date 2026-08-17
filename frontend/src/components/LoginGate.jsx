import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

export default function LoginGate({ children }) {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [mode, setMode] = useState("login"); // "login" | "forgot"
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotSubmitting(true);
    setForgotMessage("");
    try {
      const res = await client.post("/auth/forgot-password", { username: forgotUsername.trim() });
      setForgotMessage(res.data.message);
    } catch (err) {
      setForgotMessage(err.response?.data?.message || "Something went wrong — please try again.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  if (loading) {
    return <div className="pin-gate-loading">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="pin-gate">
        {mode === "login" ? (
          <form className="pin-gate__card" onSubmit={handleSubmit}>
            <div className="pin-gate__brand">
              <span className="sidebar__brand-mark">#</span>Examination Management System
            </div>
            <p className="pin-gate__label">Log in to continue</p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              autoCapitalize="none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            {error && <div className="alert alert-error">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </button>
            <button
              type="button"
              className="pin-gate__link"
              onClick={() => {
                setMode("forgot");
                setForgotUsername(username);
                setForgotMessage("");
              }}
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form className="pin-gate__card" onSubmit={handleForgotSubmit}>
            <div className="pin-gate__brand">
              <span className="sidebar__brand-mark">#</span>Examination Management System
            </div>
            <p className="pin-gate__label">
              Enter your username — if your account has an email on file, we'll send a new
              temporary password to it.
            </p>
            <input
              type="text"
              value={forgotUsername}
              onChange={(e) => setForgotUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              autoCapitalize="none"
            />
            {forgotMessage && <div className="alert alert-success">{forgotMessage}</div>}
            <button type="submit" className="btn btn-primary" disabled={forgotSubmitting}>
              {forgotSubmitting ? "Sending…" : "Send new password"}
            </button>
            <button
              type="button"
              className="pin-gate__link"
              onClick={() => {
                setMode("login");
                setForgotMessage("");
              }}
            >
              Back to log in
            </button>
          </form>
        )}
      </div>
    );
  }

  return children;
}
