import { Fragment, useEffect, useMemo, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { downloadCsv } from "../utils/csv";
import { decorateRow, THEORY_PASS_MARK } from "../utils/grading";

export default function ResultsPage() {
  const { showToast, confirm } = useUI();
  const { user } = useAuth();
  const scopeSubject = user?.role === "teacher" ? user.teacherSubject : null;

  const [studentClass, setStudentClass] = useState("11");
  const [faculty, setFaculty] = useState("");
  const [faculties, setFaculties] = useState([]);
  const [examName, setExamName] = useState("");
  const [exams, setExams] = useState([]);

  const [subjectColumns, setSubjectColumns] = useState([]);
  const [rows, setRows] = useState([]); // [{ student, absent, marks, ...computed }]
  const [ledgerSortKey, setLedgerSortKey] = useState("roll");
  const [ledgerSortDir, setLedgerSortDir] = useState("asc");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null); // { studentClass, faculty, examName }

  useEffect(() => {
    client
      .get("/exams")
      .then((res) => {
        setExams(res.data.data);
        if (res.data.data.length > 0) setExamName(res.data.data[0].name);
      })
      .catch(() => {});
    client
      .get("/faculties")
      .then((res) => {
        setFaculties(res.data.data);
        if (res.data.data.length > 0) setFaculty(res.data.data[0].name);
      })
      .catch(() => {});
  }, []);

  const handleLoadLedger = async () => {
    if (!examName.trim()) {
      showToast("Enter an exam name first", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await client.get("/results/ledger", {
        params: { examName: examName.trim(), studentClass, faculty },
      });
      setSubjectColumns(res.data.subjectColumns);
      setRows(
        res.data.data.map((row) => ({
          student: row.student,
          absent: row.absent,
          ...decorateRow(row.marks),
        }))
      );
      setLoadedFor({ studentClass, faculty, examName: examName.trim() });
      if (res.data.data.length === 0) {
        showToast(`No students found in Class ${studentClass} ${faculty}`, "error");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load ledger", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId, subject, field, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.student._id !== studentId) return row;
        const updatedMarks = row.marks.map((m) => {
          if (m.subject !== subject) return m;
          const maxAllowed = field === "theoryObtained" ? m.theoryFullMarks : m.practicalFullMarks;
          let numeric = Number(value);
          if (Number.isNaN(numeric)) numeric = 0;
          numeric = Math.max(0, Math.min(numeric, maxAllowed));
          return { ...m, [field]: numeric };
        });
        return { student: row.student, absent: row.absent, ...decorateRow(updatedMarks) };
      })
    );
  };

  const handleAbsentToggle = (studentId, absent) => {
    setRows((prev) =>
      prev.map((row) => (row.student._id === studentId ? { ...row, absent } : row))
    );
  };

  const handleSaveLedger = async () => {
    if (!loadedFor) return;
    setSaving(true);
    try {
      const entries = rows.map((row) => ({
        studentId: row.student._id,
        absent: row.absent,
        marks: row.marks.map((m) => ({
          subject: m.subject,
          theoryObtained: Number(m.theoryObtained) || 0,
          practicalObtained: Number(m.practicalObtained) || 0,
        })),
      }));
      const res = await client.post("/results/ledger", { examName: loadedFor.examName, entries });

      if (res.data.savedCount > 0) {
        showToast(
          `Saved ${res.data.savedCount} student(s)` +
            (res.data.failedCount ? `, ${res.data.failedCount} failed` : "")
        );
      }

      if (res.data.failedCount > 0) {
        // Show the actual reason(s), not just a count — e.g. "not a valid
        // subject", "student not found" — so a failure is diagnosable
        // directly from the toast instead of a silent "X failed".
        const uniqueReasons = [...new Set(res.data.failed.map((f) => f.reason))];
        uniqueReasons.forEach((reason) => showToast(reason, "error"));
      }

      if (res.data.savedCount > 0) {
        handleLoadLedger();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save ledger", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePrintLedger = () => window.print();

  const handleExportLedger = () => {
    if (rows.length === 0) return;
    const exportRows = rows.map((row) => {
      const base = { Roll: row.student.roll, Name: row.student.name };
      subjectColumns.forEach((col) => {
        const m = row.marks.find((mk) => mk.subject === col);
        base[`${col} Th`] = row.absent ? "AB" : m?.theoryObtained ?? "—";
        base[`${col} Pr`] = row.absent ? "AB" : m?.practicalObtained ?? "—";
      });
      base["Total"] = row.absent ? "AB" : `${row.totalObtained}/${row.totalFull}`;
      base["%"] = row.absent ? "—" : row.percentage;
      base["Grade"] = row.grade;
      base["GPA"] = row.gpa;
      base["Status"] = row.passed ? "Pass" : "Fail";
      return base;
    });
    downloadCsv(`ledger-${studentClass}-${faculty}-${examName}.csv`, exportRows);
  };

  const handleClearLedger = async () => {
    const ok = await confirm("Discard the current ledger view? Unsaved changes will be lost.");
    if (!ok) return;
    setRows([]);
    setSubjectColumns([]);
    setLoadedFor(null);
  };

  const classAverage = useMemo(() => {
    const graded = rows.filter((r) => !r.absent);
    if (graded.length === 0) return null;
    const sum = graded.reduce((s, r) => s + r.percentage, 0);
    return Math.round((sum / graded.length) * 100) / 100;
  }, [rows]);

  const sortedRows = useMemo(() => {
    const getValue = (row) => {
      if (ledgerSortKey === "roll") return row.student.roll;
      if (ledgerSortKey === "name") return row.student.name;
      return row.percentage;
    };
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return ledgerSortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, ledgerSortKey, ledgerSortDir]);

  const toggleLedgerSort = (key) => {
    if (ledgerSortKey === key) {
      setLedgerSortDir(ledgerSortDir === "asc" ? "desc" : "asc");
    } else {
      setLedgerSortKey(key);
      setLedgerSortDir("asc");
    }
  };
  const ledgerSortArrow = (key) =>
    ledgerSortKey === key ? (ledgerSortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="main">
      <div className="page-header no-print">
        <div>
          <h1>Results</h1>
          <p>
            {scopeSubject
              ? `Enter marks for ${scopeSubject} — every other subject is locked to you.`
              : "Enter marks for a whole class at once — grading and pass/fail follow NEB rules."}
          </p>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <div className="form-row">
            <div className="field" style={{ maxWidth: 140 }}>
              <label htmlFor="ledgerClass">Class</label>
              <select id="ledgerClass" value={studentClass} onChange={(e) => setStudentClass(e.target.value)}>
                <option value="11">Class 11</option>
                <option value="12">Class 12</option>
              </select>
            </div>
            <div className="field" style={{ maxWidth: 180 }}>
              <label htmlFor="ledgerFaculty">Faculty</label>
              <select id="ledgerFaculty" value={faculty} onChange={(e) => setFaculty(e.target.value)}>
                {faculties.length === 0 && <option value="">No faculties configured</option>}
                {faculties.map((f) => (
                  <option key={f._id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ledgerExam">Exam</label>
              <select id="ledgerExam" value={examName} onChange={(e) => setExamName(e.target.value)}>
                {exams.length === 0 && <option value="">No exams added yet — see Dashboard</option>}
                {exams.map((ex) => (
                  <option key={ex._id} value={ex.name}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleLoadLedger}
              disabled={loading || exams.length === 0}
            >
              {loading ? "Loading…" : "Load Ledger"}
            </button>
          </div>
          {exams.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--danger)", margin: "10px 0 0" }}>
              No exams have been added yet. An admin needs to add one from the Dashboard first.
            </p>
          )}
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
            Theory pass mark is {THEORY_PASS_MARK} out of that subject's theory total (75 for most subjects, 50 for Computer) — a subject cell turns red if a student
            falls below it. For Science, only the student's own optional subject (Biology or
            Computer) accepts marks — the other stays locked.
          </p>
        </div>
      </div>

      {loadedFor && rows.length > 0 && (
        <>
          <div className="row-actions no-print" style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={handleSaveLedger} disabled={saving}>
              {saving ? "Saving…" : "Save Ledger"}
            </button>
            <button className="btn btn-ghost" onClick={handlePrintLedger}>
              Print Ledger
            </button>
            <button className="btn btn-ghost" onClick={handleExportLedger}>
              Export CSV
            </button>
            <button className="btn btn-ghost" onClick={handleClearLedger}>
              Clear
            </button>
          </div>

          <div className="ledger-print-block">
            <div className="ledger-letterhead">
              <div className="ledger-letterhead__brand">Examination Management System</div>
              <div className="ledger-letterhead__title">
                Class {loadedFor.studentClass} {loadedFor.faculty} — Mark Ledger
              </div>
              <div className="ledger-letterhead__subtitle">
                {loadedFor.examName} · Theory pass mark: {THEORY_PASS_MARK} · Class average:{" "}
                {classAverage}% · Generated {new Date().toLocaleDateString()}
              </div>
            </div>

            <div className="table-scroll ledger-table-scroll">
              <table className="ledger-table ledger-table--big">
                <thead>
                  <tr>
                    <th rowSpan={2}>S.N.</th>
                    <th rowSpan={2} className="sortable" onClick={() => toggleLedgerSort("roll")}>
                      Roll{ledgerSortArrow("roll")}
                    </th>
                    <th rowSpan={2} className="sortable" onClick={() => toggleLedgerSort("name")}>
                      Student Name{ledgerSortArrow("name")}
                    </th>
                    <th rowSpan={2}>Absent</th>
                    {subjectColumns.map((col) => (
                      <th key={col} colSpan={2}>
                        {col}
                      </th>
                    ))}
                    <th rowSpan={2}>Total</th>
                    <th rowSpan={2} className="sortable" onClick={() => toggleLedgerSort("percentage")}>
                      %{ledgerSortArrow("percentage")}
                    </th>
                    <th rowSpan={2}>Grade</th>
                    <th rowSpan={2}>GPA</th>
                    <th rowSpan={2}>Status</th>
                  </tr>
                  <tr>
                    {subjectColumns.map((col) => (
                      <Fragment key={col}>
                        <th className="ledger-subhead">Th</th>
                        <th className="ledger-subhead">Pr</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, i) => (
                    <tr key={row.student._id} className={row.absent ? "ledger-row--absent" : ""}>
                      <td>{i + 1}</td>
                      <td>
                        <span className="roll-tag">{row.student.roll}</span>
                      </td>
                      <td>{row.student.name}</td>
                      <td>
                        <input
                          type="checkbox"
                          className="no-print"
                          checked={row.absent}
                          disabled={Boolean(scopeSubject)}
                          title={scopeSubject ? "Only an admin can mark a student absent for the whole exam" : undefined}
                          onChange={(e) => handleAbsentToggle(row.student._id, e.target.checked)}
                        />
                        <span className="print-only">{row.absent ? "AB" : ""}</span>
                      </td>
                      {subjectColumns.map((col) => {
                        const mark = row.marks.find((m) => m.subject === col);
                        if (!mark) {
                          return (
                            <Fragment key={col}>
                              <td className="ledger-cell--na" title="Not this student's optional subject">
                                —
                              </td>
                              <td className="ledger-cell--na">—</td>
                            </Fragment>
                          );
                        }
                        const failed = !row.absent && !mark.passed;
                        const outOfScope = scopeSubject && mark.subject !== scopeSubject;
                        return (
                          <Fragment key={col}>
                            <td className={failed ? "ledger-cell--fail" : outOfScope ? "ledger-cell--na" : ""}>
                              <input
                                type="number"
                                min="0"
                                max={mark.theoryFullMarks}
                                value={mark.theoryObtained}
                                disabled={row.absent || outOfScope}
                                className="ledger-input no-print"
                                onChange={(e) =>
                                  handleMarkChange(row.student._id, mark.subject, "theoryObtained", e.target.value)
                                }
                              />
                              <span className="print-only">
                                {row.absent ? "AB" : mark.theoryObtained}
                              </span>
                            </td>
                            <td className={outOfScope ? "ledger-cell--na" : ""}>
                              <input
                                type="number"
                                min="0"
                                max={mark.practicalFullMarks}
                                value={mark.practicalObtained}
                                disabled={row.absent || outOfScope}
                                className="ledger-input no-print"
                                onChange={(e) =>
                                  handleMarkChange(row.student._id, mark.subject, "practicalObtained", e.target.value)
                                }
                              />
                              <span className="print-only">
                                {row.absent ? "AB" : mark.practicalObtained}
                              </span>
                            </td>
                          </Fragment>
                        );
                      })}
                      <td>{row.absent ? "AB" : `${row.totalObtained}/${row.totalFull}`}</td>
                      <td>{row.absent ? "—" : `${row.percentage}%`}</td>
                      <td>
                        <span className="subject-pill">{row.absent ? "AB" : row.grade}</span>
                      </td>
                      <td>{row.absent ? "—" : row.gpa}</td>
                      <td>
                        <span className={row.passed ? "status-pill status-pill--pass" : "status-pill status-pill--fail"}>
                          {row.passed ? "Pass" : "Fail"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ledger-signature">
              <div className="ledger-signature__line">Class Teacher</div>
              <div className="ledger-signature__line">Exam Coordinator</div>
              <div className="ledger-signature__line">Principal</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
