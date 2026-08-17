import { useEffect, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";

export default function SettingsPage() {
  const { showToast } = useUI();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await client.get("/settings");
      setSettings(res.data.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleFieldChange = (field, value) => {
    setSettings({ ...settings, [field]: Number(value) });
  };

  const handleBandChange = (index, field, value) => {
    const gradeScale = settings.gradeScale.map((b, i) =>
      i === index ? { ...b, [field]: field === "grade" ? value : Number(value) } : b
    );
    setSettings({ ...settings, gradeScale });
  };

  const handleAddBand = () => {
    setSettings({ ...settings, gradeScale: [...settings.gradeScale, { min: 0, grade: "New", gpa: 0 }] });
  };

  const handleRemoveBand = (index) => {
    setSettings({ ...settings, gradeScale: settings.gradeScale.filter((_, i) => i !== index) });
  };

  const handleOverrideChange = (index, field, value) => {
    const subjectOverrides = settings.subjectOverrides.map((o, i) =>
      i === index ? { ...o, [field]: field === "subject" ? value : Number(value) } : o
    );
    setSettings({ ...settings, subjectOverrides });
  };

  const handleAddOverride = () => {
    setSettings({
      ...settings,
      subjectOverrides: [...settings.subjectOverrides, { subject: "", theoryFullMarks: 75, practicalFullMarks: 25 }],
    });
  };

  const handleRemoveOverride = (index) => {
    setSettings({ ...settings, subjectOverrides: settings.subjectOverrides.filter((_, i) => i !== index) });
  };

  const [testEmailTo, setTestEmailTo] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);

  const handleSmtpChange = (field, value) => {
    setSettings({ ...settings, smtp: { ...settings.smtp, [field]: field === "port" ? Number(value) : value } });
  };

  const handleSendTestEmail = async () => {
    if (!testEmailTo.trim()) {
      showToast("Enter an email address to send the test to", "error");
      return;
    }
    setTestingEmail(true);
    try {
      const res = await client.post("/settings/test-email", { to: testEmailTo.trim() });
      showToast(res.data.message);
    } catch (err) {
      showToast(err.response?.data?.message || "Test email failed", "error");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await client.put("/settings", settings);
      setSettings(res.data.data);
      showToast("Settings saved.");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="main">
        <div className="loading-state">Loading…</div>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Grading rules used across the whole system — no code changes needed to adjust these.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <div className="form-row">
            <div className="field">
              <label htmlFor="theoryPassMark">Theory pass mark</label>
              <input
                id="theoryPassMark"
                type="number"
                value={settings.theoryPassMark}
                onChange={(e) => handleFieldChange("theoryPassMark", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="theoryFullMarks">Theory full marks</label>
              <input
                id="theoryFullMarks"
                type="number"
                value={settings.theoryFullMarks}
                onChange={(e) => handleFieldChange("theoryFullMarks", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="practicalFullMarks">Practical full marks</label>
              <input
                id="practicalFullMarks"
                type="number"
                value={settings.practicalFullMarks}
                onChange={(e) => handleFieldChange("practicalFullMarks", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <h3 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}>
            Email (SMTP) — for password resets and duty/result notifications
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            For Gmail: host smtp.gmail.com, port 587, and a 16-character{" "}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              App Password
            </a>{" "}
            (not your normal Gmail password) — you'll need 2-Step Verification turned on first.
          </p>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="smtpHost">SMTP host</label>
              <input
                id="smtpHost"
                value={settings.smtp?.host || ""}
                onChange={(e) => handleSmtpChange("host", e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="field" style={{ maxWidth: 100 }}>
              <label htmlFor="smtpPort">Port</label>
              <input
                id="smtpPort"
                type="number"
                value={settings.smtp?.port || 587}
                onChange={(e) => handleSmtpChange("port", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="smtpUser">Username / email</label>
              <input
                id="smtpUser"
                value={settings.smtp?.user || ""}
                onChange={(e) => handleSmtpChange("user", e.target.value)}
                placeholder="youraddress@gmail.com"
              />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="smtpPass">Password / App Password</label>
              <input
                id="smtpPass"
                type="password"
                value={settings.smtp?.pass === "__UNCHANGED__" ? "" : settings.smtp?.pass || ""}
                onChange={(e) => handleSmtpChange("pass", e.target.value)}
                placeholder={
                  settings.smtp?.pass === "__UNCHANGED__" ? "Already set — leave blank to keep it" : ""
                }
              />
            </div>
            <div className="field">
              <label htmlFor="smtpFrom">"From" name (optional)</label>
              <input
                id="smtpFrom"
                value={settings.smtp?.from || ""}
                onChange={(e) => handleSmtpChange("from", e.target.value)}
                placeholder='Examination Management System <youraddress@gmail.com>'
              />
            </div>
          </div>

          <div className="form-row" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div className="field">
              <label htmlFor="testEmailTo">Send a test email to</label>
              <input
                id="testEmailTo"
                type="email"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button type="button" className="btn btn-ghost" onClick={handleSendTestEmail} disabled={testingEmail}>
              {testingEmail ? "Sending…" : "Send test email"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
            Save your SMTP settings below first, then use this to confirm they actually work.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <h3 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}>
            Per-subject full marks overrides
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Any subject not listed here uses the default split above (Computer defaults to 50/50
            since it usually has a heavier practical component).
          </p>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Theory full marks</th>
                <th>Practical full marks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {settings.subjectOverrides.map((o, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="ledger-input"
                      style={{ width: 120 }}
                      value={o.subject}
                      placeholder="e.g. Computer"
                      onChange={(e) => handleOverrideChange(i, "subject", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="ledger-input"
                      style={{ width: 70 }}
                      value={o.theoryFullMarks}
                      onChange={(e) => handleOverrideChange(i, "theoryFullMarks", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="ledger-input"
                      style={{ width: 70 }}
                      value={o.practicalFullMarks}
                      onChange={(e) => handleOverrideChange(i, "practicalFullMarks", e.target.value)}
                    />
                  </td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => handleRemoveOverride(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={handleAddOverride}>
            Add override
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <h3 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>Grade scale</h3>
          <table>
            <thead>
              <tr>
                <th>Minimum %</th>
                <th>Grade label</th>
                <th>GPA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {settings.gradeScale.map((band, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="number"
                      className="ledger-input"
                      style={{ width: 70 }}
                      value={band.min}
                      onChange={(e) => handleBandChange(i, "min", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="ledger-input"
                      style={{ width: 70 }}
                      value={band.grade}
                      onChange={(e) => handleBandChange(i, "grade", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      className="ledger-input"
                      style={{ width: 70 }}
                      value={band.gpa}
                      onChange={(e) => handleBandChange(i, "gpa", e.target.value)}
                    />
                  </td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => handleRemoveBand(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={handleAddBand}>
            Add band
          </button>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
