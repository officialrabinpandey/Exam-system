import { useEffect, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";

const emptyForm = { name: "", compulsorySubjects: "", electiveGroupName: "", electiveOptions: "" };

export default function FacultiesPage() {
  const { showToast, confirm } = useUI();
  const [faculties, setFaculties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadFaculties = async () => {
    setLoading(true);
    try {
      const res = await client.get("/faculties");
      setFaculties(res.data.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load faculties", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaculties();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const splitList = (s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      compulsorySubjects: splitList(form.compulsorySubjects),
      electiveGroupName: form.electiveGroupName.trim(),
      electiveOptions: splitList(form.electiveOptions),
    };
    try {
      if (editingId) {
        await client.put(`/faculties/${editingId}`, payload);
        showToast("Faculty updated.");
      } else {
        await client.post("/faculties", payload);
        showToast("Faculty added.");
      }
      setForm(emptyForm);
      setEditingId(null);
      loadFaculties();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save faculty", "error");
    }
  };

  const handleEdit = (faculty) => {
    setEditingId(faculty._id);
    setForm({
      name: faculty.name,
      compulsorySubjects: faculty.compulsorySubjects.join(", "),
      electiveGroupName: faculty.electiveGroupName,
      electiveOptions: faculty.electiveOptions.join(", "),
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this faculty? Students currently enrolled in it will block this.");
    if (!ok) return;
    try {
      await client.delete(`/faculties/${id}`);
      showToast("Faculty deleted.");
      loadFaculties();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete faculty", "error");
    }
  };

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1>Faculties</h1>
          <p>Define each faculty's subjects — add a new faculty without any code changes.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <form onSubmit={handleSubmit}>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="field">
                <label htmlFor="name">Faculty name</label>
                <input id="name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Humanities" required />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="compulsorySubjects">Compulsory subjects (comma-separated)</label>
              <input
                id="compulsorySubjects"
                name="compulsorySubjects"
                value={form.compulsorySubjects}
                onChange={handleChange}
                placeholder="e.g. English, Nepali, Economics"
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="electiveGroupName">Elective group name (optional)</label>
                <input
                  id="electiveGroupName"
                  name="electiveGroupName"
                  value={form.electiveGroupName}
                  onChange={handleChange}
                  placeholder="e.g. Science Elective — leave blank if none"
                />
              </div>
              <div className="field">
                <label htmlFor="electiveOptions">Elective options (comma-separated)</label>
                <input
                  id="electiveOptions"
                  name="electiveOptions"
                  value={form.electiveOptions}
                  onChange={handleChange}
                  placeholder="e.g. Biology, Computer"
                />
              </div>
              <button type="submit" className="btn btn-primary">
                {editingId ? "Save changes" : "Add faculty"}
              </button>
              {editingId && (
                <button type="button" className="btn btn-ghost" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
              A student in this faculty picks exactly one elective option (like Science's Computer/Biology
              choice) — leave the elective fields blank for a faculty with no choice.
            </p>
          </form>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : faculties.length === 0 ? (
          <div className="empty-state">No faculties yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Faculty</th>
                <th>Compulsory subjects</th>
                <th>Elective options</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faculties.map((f) => (
                <tr key={f._id}>
                  <td>{f.name}</td>
                  <td style={{ fontSize: 12 }}>{f.compulsorySubjects.join(", ")}</td>
                  <td style={{ fontSize: 12 }}>
                    {f.electiveOptions.length > 0 ? f.electiveOptions.join(" / ") : "—"}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => handleEdit(f)}>
                        Edit
                      </button>
                      <button className="btn btn-ghost" onClick={() => handleDelete(f._id)}>
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
