import { useEffect, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";

const emptyForm = { username: "", email: "", password: "", role: "viewer", teacherId: "" };

export default function UsersPage() {
  const { showToast, confirm } = useUI();
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await client.get("/auth/users");
      setUsers(res.data.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    const res = await client.get("/teachers");
    setTeachers(res.data.data);
  };

  useEffect(() => {
    loadUsers();
    loadTeachers();
  }, []);

  if (!isAdmin) {
    return (
      <div className="main">
        <div className="page-header">
          <div>
            <h1>Users</h1>
            <p>Only an admin can manage user accounts.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post("/auth/users", {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        teacherId: form.role === "teacher" ? form.teacherId : undefined,
      });
      showToast("User created.");
      setForm(emptyForm);
      loadUsers();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to create user", "error");
    }
  };

  const handleResetPassword = async (user) => {
    const newPassword = window.prompt(`New password for "${user.username}" (min 6 characters):`);
    if (!newPassword) return;
    try {
      await client.patch(`/auth/users/${user._id}/reset-password`, { newPassword });
      showToast(`Password reset for ${user.username}.`);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to reset password", "error");
    }
  };

  const handleDelete = async (user) => {
    const ok = await confirm(`Delete user "${user.username}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await client.delete(`/auth/users/${user._id}`);
      showToast("User deleted.");
      loadUsers();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete user", "error");
    }
  };

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Manage who can log in and what they can do.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="username">Username</label>
                <input id="username" name="username" value={form.username} onChange={handleChange} required />
              </div>
              <div className="field">
                <label htmlFor="email">Email (for password reset)</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="optional, but needed for self-service reset"
                />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min 6 characters"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="role">Role</label>
                <select id="role" name="role" value={form.role} onChange={handleChange}>
                  <option value="admin">Admin — full access</option>
                  <option value="viewer">Viewer — read-only, everything</option>
                  <option value="teacher">Teacher — enters marks for their own subject only</option>
                </select>
              </div>
              {form.role === "teacher" && (
                <div className="field">
                  <label htmlFor="teacherId">Linked teacher</label>
                  <select id="teacherId" name="teacherId" value={form.teacherId} onChange={handleChange} required>
                    <option value="">Select a teacher</option>
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.subject})
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
                    This user will only be able to enter Results ledger marks for {teachers.find((t) => t._id === form.teacherId)?.subject || "their subject"}.
                  </p>
                </div>
              )}
              <button type="submit" className="btn btn-primary">
                Create user
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : users.length === 0 ? (
          <div className="empty-state">No users yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Linked teacher</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.username}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email || "—"}</td>
                  <td>
                    <span className="subject-pill">{u.role}</span>
                  </td>
                  <td>{u.teacher?.name || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => handleResetPassword(u)}>
                        Reset password
                      </button>
                      <button className="btn btn-ghost" onClick={() => handleDelete(u)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
