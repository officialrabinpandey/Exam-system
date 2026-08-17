import { Fragment, useEffect, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";

const emptyForm = { name: "", subject: "" };

export default function TeachersPage() {
  const { showToast, confirm } = useUI();
  const [teachers, setTeachers] = useState([]);
  const [dutySummary, setDutySummary] = useState({}); // teacherId -> { autoCount, manualDutyAdjustment, dutyCount }
  const [duties, setDuties] = useState([]); // all seating plans with a teacher assigned
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTeacherId, setExpandedTeacherId] = useState(null);
  const [printingTeacherId, setPrintingTeacherId] = useState(null);
  const [editingDutyId, setEditingDutyId] = useState(null);
  const [dutyDraft, setDutyDraft] = useState("");

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const res = await client.get("/teachers");
      setTeachers(res.data.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load teachers", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadDutySummary = async () => {
    try {
      const res = await client.get("/teachers/duty-summary");
      const map = {};
      res.data.data.forEach((t) => (map[t._id] = t));
      setDutySummary(map);
    } catch {
      // supplementary — non-fatal if it fails
    }
  };

  const loadDuties = async () => {
    try {
      const res = await client.get("/seating");
      setDuties(res.data.data.filter((s) => s.teacher));
    } catch {
      // supplementary — non-fatal if it fails
    }
  };

  useEffect(() => {
    loadTeachers();
    loadDutySummary();
    loadDuties();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await client.put(`/teachers/${editingId}`, form);
        showToast("Teacher updated.");
      } else {
        await client.post("/teachers", form);
        showToast("Teacher added.");
      }
      setForm(emptyForm);
      setEditingId(null);
      loadTeachers();
      loadDutySummary();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save teacher", "error");
    }
  };

  const handleEdit = (teacher) => {
    setEditingId(teacher._id);
    setForm({ name: teacher.name, subject: teacher.subject });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this teacher? This cannot be undone.");
    if (!ok) return;
    try {
      await client.delete(`/teachers/${id}`);
      showToast("Teacher deleted.");
      loadTeachers();
      loadDutySummary();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete teacher", "error");
    }
  };

  const toggleExpand = (teacherId) => {
    setExpandedTeacherId(expandedTeacherId === teacherId ? null : teacherId);
  };

  const startEditDuty = (teacher) => {
    setEditingDutyId(teacher._id);
    setDutyDraft(String(dutySummary[teacher._id]?.dutyCount ?? 0));
  };

  const cancelEditDuty = () => {
    setEditingDutyId(null);
    setDutyDraft("");
  };

  const saveDutyCount = async (teacherId) => {
    const totalDuties = Number(dutyDraft);
    if (isNaN(totalDuties)) {
      showToast("Enter a valid number", "error");
      return;
    }
    try {
      await client.patch(`/teachers/${teacherId}/duty-count`, { totalDuties });
      showToast("Duty count updated.");
      setEditingDutyId(null);
      loadDutySummary();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update duty count", "error");
    }
  };

  const dutiesFor = (teacherId) =>
    duties
      .filter((d) => d.teacher?._id === teacherId)
      .sort((a, b) => a.examDate.localeCompare(b.examDate));

  const handlePrintDuties = (teacher) => {
    setPrintingTeacherId(teacher._id);
    // Wait a tick for the active print block to render before invoking print
    setTimeout(() => {
      window.print();
      setPrintingTeacherId(null);
    }, 50);
  };

  return (
    <div className="main">
      <div className="page-header no-print">
        <div>
          <h1>Teachers</h1>
          <p>Manage the teacher list used for exam duty allocation.</p>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Sita Gurung"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="subject">Subject</label>
                <input
                  id="subject"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="e.g. Mathematics"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                {editingId ? "Save changes" : "Add teacher"}
              </button>
              {editingId && (
                <button type="button" className="btn btn-ghost" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 32 }}>
        {loading ? (
          <div className="loading-state">Loading teachers…</div>
        ) : teachers.length === 0 ? (
          <div className="empty-state">No teachers yet. Add one above to get started.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                  <th>Duties</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <Fragment key={t._id}>
                    <tr>
                      <td>{t.name}</td>
                      <td>
                        <span className="subject-pill">{t.subject}</span>
                      </td>
                      <td>
                        {editingDutyId === t._id ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="number"
                              value={dutyDraft}
                              onChange={(e) => setDutyDraft(e.target.value)}
                              style={{
                                width: 60,
                                padding: "4px 6px",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                fontSize: 13,
                              }}
                              autoFocus
                            />
                            <button
                              className="btn btn-ghost"
                              style={{ padding: "4px 8px" }}
                              onClick={() => saveDutyCount(t._id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: "4px 8px" }}
                              onClick={cancelEditDuty}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span
                            className="duty-count-editable"
                            onClick={() => startEditDuty(t)}
                            title="Click to manually correct this teacher's duty count"
                          >
                            {dutySummary[t._id]?.dutyCount ?? 0}
                            <span className="duty-count-editable__icon">✎</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-ghost" onClick={() => toggleExpand(t._id)}>
                            {expandedTeacherId === t._id ? "Hide Duties" : "View Duties"}
                          </button>
                          <button className="btn btn-ghost" onClick={() => handlePrintDuties(t)}>
                            Print Duties
                          </button>
                          <button className="btn btn-ghost" onClick={() => handleEdit(t)}>
                            Edit
                          </button>
                          <button className="btn btn-ghost" onClick={() => handleDelete(t._id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedTeacherId === t._id && (
                      <tr>
                        <td colSpan={4} style={{ background: "var(--surface-alt)" }}>
                          {dutiesFor(t._id).length === 0 ? (
                            <div style={{ padding: "8px 4px", fontSize: 13, color: "var(--text-muted)" }}>
                              No duties assigned yet.
                            </div>
                          ) : (
                            <div className="duty-list" style={{ padding: "8px 4px" }}>
                              {dutiesFor(t._id).map((d) => (
                                <div className="duty-row" key={d._id}>
                                  <span style={{ fontFamily: "var(--font-mono)" }}>{d.examDate}</span>
                                  <span className="subject-pill">{d.room?.name || "Unknown room"}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable per-teacher schedule blocks — hidden on screen, shown one at a time when printing */}
      <div className="teacher-print-schedules">
        {teachers.map((t) => (
          <div
            className={
              "teacher-print-schedule" +
              (printingTeacherId === t._id ? " teacher-print-schedule--active" : "")
            }
            key={t._id}
          >
            <div className="teacher-print-schedule__letterhead">
              <div className="teacher-print-schedule__title">Exam Duty Schedule</div>
              <div className="teacher-print-schedule__generated">
                Generated {new Date().toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
            <div className="teacher-print-schedule__meta">
              <div>
                <div className="teacher-print-schedule__meta-label">Teacher</div>
                <div className="teacher-print-schedule__meta-value">{t.name}</div>
              </div>
              <div>
                <div className="teacher-print-schedule__meta-label">Subject</div>
                <div className="teacher-print-schedule__meta-value">{t.subject}</div>
              </div>
              <div>
                <div className="teacher-print-schedule__meta-label">Total Duties</div>
                <div className="teacher-print-schedule__meta-value">{dutiesFor(t._id).length}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {dutiesFor(t._id).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "#666" }}>
                      No duties assigned
                    </td>
                  </tr>
                ) : (
                  dutiesFor(t._id).map((d, i) => (
                    <tr key={d._id}>
                      <td>{i + 1}</td>
                      <td>{d.examDate}</td>
                      <td>{d.room?.name || "Unknown room"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="teacher-print-schedule__signature">
              <div className="teacher-print-schedule__signature-line">
                <span>Teacher's Signature</span>
              </div>
              <div className="teacher-print-schedule__signature-line">
                <span>Exam Coordinator's Signature</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
