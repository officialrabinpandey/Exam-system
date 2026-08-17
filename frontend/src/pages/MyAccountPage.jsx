import { useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";

export default function MyAccountPage() {
  const { showToast } = useUI();
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      await client.patch("/auth/me/email", { email });
      showToast("Email updated.");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update email", "error");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters", "error");
      return;
    }
    setSavingPassword(true);
    try {
      await client.patch("/auth/me/password", { currentPassword, newPassword });
      showToast("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to change password", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1>My Account</h1>
          <p>Signed in as {user?.username} ({user?.role}).</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <h3 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}>Email</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Used only for "Forgot password?" on the login screen — set this so you're never
            locked out.
          </p>
          <form onSubmit={handleSaveEmail} className="form-row">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingEmail}>
              {savingEmail ? "Saving…" : "Save email"}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card__section">
          <h3 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>
            Change password
          </h3>
          <form onSubmit={handleChangePassword} className="form-row">
            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingPassword}>
              {savingPassword ? "Saving…" : "Change password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
