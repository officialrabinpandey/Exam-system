import { useEffect, useState } from "react";
import client from "../api/client";
import SeatGrid from "../components/SeatGrid";
import { useUI } from "../context/UIContext";
import { downloadCsv } from "../utils/csv";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function SeatingPage() {
  const { showToast, confirm } = useUI();
  const [rooms, setRooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [history, setHistory] = useState([]);
  const [showArchived, setShowArchived] = useState(false);

  const [examDate, setExamDate] = useState(todayISO());
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [multiRoomIds, setMultiRoomIds] = useState([]);

  const [displayedPlans, setDisplayedPlans] = useState([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set());
  const [historyDateFilter, setHistoryDateFilter] = useState("");

  const [generating, setGenerating] = useState(false);

  const loadRooms = async () => {
    const res = await client.get("/rooms");
    setRooms(res.data.data);
    if (res.data.data.length > 0) setSelectedRoomId(res.data.data[0]._id);
  };
  const loadTeachers = async () => {
    const res = await client.get("/teachers");
    setTeachers(res.data.data);
  };
  const loadStudents = async () => {
    const res = await client.get("/students");
    setStudents(res.data.data);
  };
  const loadHistory = async (includeArchived = showArchived) => {
    const res = await client.get("/seating", { params: { includeArchived } });
    setHistory(res.data.data);
  };

  useEffect(() => {
    loadRooms();
    loadTeachers();
    loadStudents();
    loadHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadHistory(showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const handleSuggestTeacher = async () => {
    try {
      const res = await client.get("/teachers/suggest");
      if (res.data.data) {
        setSelectedTeacherId(res.data.data._id);
        showToast(`Suggested ${res.data.data.name} (${res.data.data.dutyCount} duties so far).`);
      } else {
        showToast("No teachers available to suggest.", "error");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to suggest a teacher", "error");
    }
  };

  const showWarnings = (warningOrWarnings) => {
    const list = Array.isArray(warningOrWarnings)
      ? warningOrWarnings
      : warningOrWarnings
      ? [warningOrWarnings]
      : [];
    list.forEach((w) => showToast(w, "error"));
  };

  const handleGenerateSingle = async (forceReplace = false) => {
    if (!selectedRoomId || !examDate) return;
    setGenerating(true);
    try {
      const res = await client.post("/seating/generate", {
        roomId: selectedRoomId,
        examDate,
        teacherId: selectedTeacherId || undefined,
        replace: forceReplace || undefined,
      });
      setDisplayedPlans([res.data.data]);
      showToast("Seating plan generated.");
      showWarnings(res.data.warning);
      loadHistory();
    } catch (err) {
      if (err.response?.status === 409 && err.response.data.conflict) {
        const ok = await confirm(err.response.data.message + " Replace it now?");
        if (ok) return handleGenerateSingle(true);
        return;
      }
      showToast(err.response?.data?.message || "Failed to generate seating", "error");
    } finally {
      setGenerating(false);
    }
  };

  const toggleMultiRoom = (roomId) => {
    setMultiRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const handleGenerateMulti = async (forceReplace = false) => {
    if (multiRoomIds.length < 1 || !examDate) return;
    setGenerating(true);
    try {
      const res = await client.post("/seating/generate-multi", {
        examDate,
        roomIds: multiRoomIds,
        replace: forceReplace || undefined,
      });
      setDisplayedPlans(res.data.data);
      showToast(`Generated seating for ${res.data.count} room(s).`);
      showWarnings(res.data.warnings);
      loadHistory();
    } catch (err) {
      if (err.response?.status === 409 && err.response.data.conflict) {
        const ok = await confirm(err.response.data.message + " Replace it now?");
        if (ok) return handleGenerateMulti(true);
        return;
      }
      showToast(
        err.response?.data?.message || "Failed to generate seating for selected rooms",
        "error"
      );
    } finally {
      setGenerating(false);
    }
  };

  const toggleHistorySelection = (id) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleViewSelected = async () => {
    if (selectedHistoryIds.size === 0) return;
    try {
      const plans = await Promise.all(
        [...selectedHistoryIds].map((id) => client.get(`/seating/${id}`).then((r) => r.data.data))
      );
      setDisplayedPlans(plans);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load selected seating plans", "error");
    }
  };

  const handleViewSinglePlan = async (id) => {
    try {
      const res = await client.get(`/seating/${id}`);
      setDisplayedPlans([res.data.data]);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load seating plan", "error");
    }
  };

  const handleDeletePlan = async (id) => {
    const ok = await confirm("Delete this seating plan permanently? This cannot be undone.");
    if (!ok) return;
    try {
      await client.delete(`/seating/${id}`);
      setDisplayedPlans((prev) => prev.filter((p) => p._id !== id));
      showToast("Seating plan deleted.");
      loadHistory();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete seating plan", "error");
    }
  };

  const handleRestorePlan = async (id) => {
    try {
      const res = await client.post(`/seating/${id}/restore`);
      showToast(`Restored the plan for ${res.data.data.room?.name}.`);
      loadHistory();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to restore seating plan", "error");
    }
  };

  const handleTeacherReassign = async (planId, teacherId) => {
    try {
      const res = await client.put(`/seating/${planId}`, { teacherId: teacherId || null });
      setDisplayedPlans((prev) => prev.map((p) => (p._id === planId ? res.data.data : p)));
      loadHistory();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update invigilator", "error");
    }
  };

  const handleSeatChange = async (planId, row, column, newStudentId) => {
    const plan = displayedPlans.find((p) => p._id === planId);
    if (!plan) return;

    const seats = plan.seats.map((s) => ({
      row: s.row,
      column: s.column,
      student: s.student?._id || s.student || null,
    }));

    const targetIndex = seats.findIndex((s) => s.row === row && s.column === column);
    if (targetIndex === -1) return;
    const previousOccupant = seats[targetIndex].student;

    if (newStudentId) {
      const swapIndex = seats.findIndex((s) => s.student === newStudentId);
      if (swapIndex !== -1 && swapIndex !== targetIndex) {
        seats[swapIndex].student = previousOccupant;
      }
    }
    seats[targetIndex].student = newStudentId;

    try {
      const res = await client.put(`/seating/${planId}`, { seats });
      setDisplayedPlans((prev) => prev.map((p) => (p._id === planId ? res.data.data : p)));
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update seat", "error");
    }
  };

  const handlePrint = () => window.print();

  const [attendanceMode, setAttendanceMode] = useState(false);

  const handleAttendanceChange = async (planId, row, column, present) => {
    try {
      const res = await client.patch(`/seating/${planId}/attendance`, { row, column, present });
      setDisplayedPlans((prev) => prev.map((p) => (p._id === planId ? res.data.data : p)));
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update attendance", "error");
    }
  };

  const handleExportPlan = (plan) => {
    downloadCsv(
      `seating-${plan.room?.name || "room"}-${plan.examDate}.csv`,
      plan.seats
        .slice()
        .sort((a, b) => a.row - b.row || a.column - b.column)
        .map((s) => ({
          Row: s.row,
          Column: s.column,
          Roll: s.student?.roll || "",
          Name: s.student?.name || "Empty",
          "Optional Subject": s.student?.optionalSubject || "",
        }))
    );
  };

  const historyDates = [...new Set(history.map((h) => h.examDate))].sort().reverse();
  const filteredHistory = historyDateFilter
    ? history.filter((h) => h.examDate === historyDateFilter)
    : history;

  return (
    <div className="main">
      <div className="page-header no-print">
        <div>
          <h1>Seating Plan</h1>
          <p>Generate a shuffled, anti-cheating seating arrangement by exam date.</p>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <div className="field" style={{ maxWidth: 220, marginBottom: 18 }}>
            <label htmlFor="examDate">Exam date</label>
            <input
              id="examDate"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>

          <h3 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
            Single room
          </h3>
          <div className="seating-toolbar" style={{ marginBottom: 22 }}>
            <div className="field" style={{ maxWidth: 240 }}>
              <label htmlFor="room">Room</label>
              <select
                id="room"
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
              >
                {rooms.length === 0 && <option value="">No rooms available</option>}
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} ({r.rows}×{r.columns} — {r.rows * r.columns} seats)
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 220 }}>
              <label htmlFor="teacher">Invigilator</label>
              <select
                id="teacher"
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
              >
                <option value="">Assign later</option>
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.subject})
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-ghost" onClick={handleSuggestTeacher}>
              Suggest fairest teacher
            </button>
            <button
              className="btn btn-accent"
              onClick={() => handleGenerateSingle(false)}
              disabled={generating || !selectedRoomId}
            >
              {generating ? "Generating…" : "Generate Seating"}
            </button>
          </div>

          <h3 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
            Multiple rooms (one exam date, no student repeated across rooms)
          </h3>
          <div className="room-checkbox-list">
            {rooms.map((r) => (
              <label key={r._id} className="room-checkbox">
                <input
                  type="checkbox"
                  checked={multiRoomIds.includes(r._id)}
                  onChange={() => toggleMultiRoom(r._id)}
                />
                {r.name} ({r.rows * r.columns} seats)
              </label>
            ))}
          </div>
          <button
            className="btn btn-accent"
            style={{ marginTop: 12 }}
            onClick={() => handleGenerateMulti(false)}
            disabled={generating || multiRoomIds.length < 1}
          >
            {generating ? "Generating…" : `Generate for ${multiRoomIds.length || ""} Selected Room(s)`}
          </button>
        </div>
      </div>

      {displayedPlans.length > 0 && (
        <div className="row-actions no-print" style={{ marginBottom: 16 }}>
          <button className="btn btn-ghost" onClick={handlePrint}>
            Print {displayedPlans.length > 1 ? `all ${displayedPlans.length} rooms` : "seating plan"}
          </button>
          <button
            className={"btn " + (attendanceMode ? "btn-accent" : "btn-ghost")}
            onClick={() => setAttendanceMode(!attendanceMode)}
          >
            {attendanceMode ? "Exit attendance mode" : "Mark attendance"}
          </button>
          {displayedPlans.map((plan) => (
            <button key={plan._id} className="btn btn-ghost" onClick={() => handleExportPlan(plan)}>
              Export {plan.room?.name} CSV
            </button>
          ))}
        </div>
      )}
      {attendanceMode && (
        <div className="alert alert-success no-print" style={{ marginBottom: 16 }}>
          Attendance mode is on — click a seat to cycle Unmarked → Present → Absent.
        </div>
      )}

      {displayedPlans.length > 0 ? (
        displayedPlans.map((plan) => (
          <div className="seat-plan-print-block" key={plan._id} style={{ marginBottom: 24 }}>
            <div className="card no-print" style={{ marginBottom: 12 }}>
              <div className="card__section" style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                <div className="field" style={{ maxWidth: 280 }}>
                  <label>Change invigilator — {plan.room?.name}</label>
                  <select
                    value={plan.teacher?._id || ""}
                    onChange={(e) => handleTeacherReassign(plan._id, e.target.value)}
                  >
                    <option value="">Not assigned</option>
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.subject})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-ghost" onClick={() => handleDeletePlan(plan._id)}>
                  Delete this plan
                </button>
              </div>
            </div>
            <SeatGrid
              seating={plan}
              students={students}
              onSeatChange={(row, column, studentId) =>
                handleSeatChange(plan._id, row, column, studentId)
              }
              attendanceMode={attendanceMode}
              onAttendanceChange={(row, column, present) =>
                handleAttendanceChange(plan._id, row, column, present)
              }
            />
          </div>
        ))
      ) : (
        <div className="card">
          <div className="empty-state">
            No seating plan displayed. Pick a room (or several) and generate above, or select saved
            plans below.
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="seating-history no-print">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ marginBottom: 0 }}>Saved seating plans</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show replaced/archived plans
              </label>
              <div className="field" style={{ maxWidth: 200 }}>
                <label htmlFor="historyDate">Filter by date</label>
                <select
                  id="historyDate"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                >
                  <option value="">All dates</option>
                  {historyDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedHistoryIds.size > 0 && (
            <button className="btn btn-accent" style={{ marginBottom: 12 }} onClick={handleViewSelected}>
              View selected ({selectedHistoryIds.size}) together
            </button>
          )}

          <ul>
            {filteredHistory.map((h) => (
              <li key={h._id} className={h.archived ? "seating-history__item--archived" : ""}>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={selectedHistoryIds.has(h._id)}
                    onChange={() => toggleHistorySelection(h._id)}
                  />
                  <span>
                    {h.examDate} — {h.room?.name || "Unknown room"} — {h.rows}×{h.columns}
                    {h.teacher?.name ? ` — Invigilator: ${h.teacher.name}` : ""}
                    {h.archived ? " — (replaced)" : ""}
                  </span>
                </label>
                <div className="row-actions">
                  {h.archived ? (
                    <button className="btn btn-ghost" onClick={() => handleRestorePlan(h._id)}>
                      Restore
                    </button>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => handleViewSinglePlan(h._id)}>
                      View
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => handleDeletePlan(h._id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
