import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { showToast, confirm } = useUI();
  const { isAdmin } = useAuth();
  const [counts, setCounts] = useState({ students: 0, rooms: 0, teachers: 0 });
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  const [exams, setExams] = useState([]);
  const [newExamName, setNewExamName] = useState("");
  const [editingExamId, setEditingExamId] = useState(null);
  const [editingExamName, setEditingExamName] = useState("");

  const loadExams = async () => {
    try {
      const res = await client.get("/exams");
      setExams(res.data.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load exams", "error");
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [studentsRes, roomsRes, teachersRes, seatingRes] = await Promise.all([
          client.get("/students"),
          client.get("/rooms"),
          client.get("/teachers"),
          client.get("/seating"),
        ]);

        setCounts({
          students: studentsRes.data.count,
          rooms: roomsRes.data.count,
          teachers: teachersRes.data.count,
        });

        const today = new Date().toISOString().slice(0, 10);
        const dates = [...new Set(seatingRes.data.data.map((s) => s.examDate))]
          .filter((d) => d >= today)
          .sort();
        setUpcoming(
          dates.map((date) => ({
            date,
            rooms: seatingRes.data.data.filter((s) => s.examDate === date).length,
          }))
        );
      } finally {
        setLoading(false);
      }
    };
    load();
    loadExams();
  }, []);

  const handleAddExam = async (e) => {
    e.preventDefault();
    if (!newExamName.trim()) return;
    try {
      await client.post("/exams", { name: newExamName.trim() });
      showToast("Exam added.");
      setNewExamName("");
      loadExams();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add exam", "error");
    }
  };

  const startEditExam = (exam) => {
    setEditingExamId(exam._id);
    setEditingExamName(exam.name);
  };

  const handleSaveExamEdit = async (id) => {
    if (!editingExamName.trim()) return;
    try {
      const res = await client.put(`/exams/${id}`, { name: editingExamName.trim() });
      showToast(
        `Exam renamed.` +
          (res.data.resultsUpdated ? ` Updated ${res.data.resultsUpdated} saved result(s) to match.` : "")
      );
      setEditingExamId(null);
      loadExams();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to rename exam", "error");
    }
  };

  const handleDeleteExam = async (exam) => {
    const ok = await confirm(
      `Remove "${exam.name}" from the exam list? Results already saved under this name are kept — this only removes it from the dropdown for new entries.`
    );
    if (!ok) return;
    try {
      await client.delete(`/exams/${exam._id}`);
      showToast("Exam removed.");
      loadExams();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete exam", "error");
    }
  };

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>A quick overview of the exam administration system.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : (
        <>
          <div className="stat-grid">
            <Link to="/students" className="stat-card">
              <div className="stat-card__value">{counts.students}</div>
              <div className="stat-card__label">Students</div>
            </Link>
            <Link to="/rooms" className="stat-card">
              <div className="stat-card__value">{counts.rooms}</div>
              <div className="stat-card__label">Rooms</div>
            </Link>
            <Link to="/teachers" className="stat-card">
              <div className="stat-card__value">{counts.teachers}</div>
              <div className="stat-card__label">Teachers</div>
            </Link>
            <Link to="/seating" className="stat-card">
              <div className="stat-card__value">{upcoming.length}</div>
              <div className="stat-card__label">Upcoming exam dates</div>
            </Link>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card__section">
              <h3 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>
                Upcoming exam dates
              </h3>
              {upcoming.length === 0 ? (
                <div className="empty-state">No upcoming seating plans generated yet.</div>
              ) : (
                <ul className="upcoming-list">
                  {upcoming.map((u) => (
                    <li key={u.date}>
                      <span>
                        {new Date(u.date + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <span className="subject-pill">
                        {u.rooms} room{u.rooms === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card__section">
              <h3 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}>
                Exam names
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                {isAdmin
                  ? "Manage the list of exams (e.g. \"First Terminal Examination\") that appear in the Results ledger dropdown."
                  : "Only an admin can add, rename, or remove exam names."}
              </p>

              {isAdmin && (
                <form onSubmit={handleAddExam} className="form-row" style={{ marginBottom: 16 }}>
                  <div className="field">
                    <label htmlFor="newExamName">New exam name</label>
                    <input
                      id="newExamName"
                      value={newExamName}
                      onChange={(e) => setNewExamName(e.target.value)}
                      placeholder="e.g. Second Terminal Examination"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Add exam
                  </button>
                </form>
              )}

              {exams.length === 0 ? (
                <div className="empty-state">No exams added yet.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Exam name</th>
                      {isAdmin && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => (
                      <tr key={exam._id}>
                        <td>
                          {editingExamId === exam._id ? (
                            <input
                              className="ledger-input"
                              style={{ width: 240 }}
                              value={editingExamName}
                              onChange={(e) => setEditingExamName(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            exam.name
                          )}
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="row-actions">
                              {editingExamId === exam._id ? (
                                <>
                                  <button className="btn btn-primary" onClick={() => handleSaveExamEdit(exam._id)}>
                                    Save
                                  </button>
                                  <button className="btn btn-ghost" onClick={() => setEditingExamId(null)}>
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button className="btn btn-ghost" onClick={() => startEditExam(exam)}>
                                    Rename
                                  </button>
                                  <button className="btn btn-ghost" onClick={() => handleDeleteExam(exam)}>
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
