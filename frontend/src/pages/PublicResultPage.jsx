import { useState } from "react";
import client from "../api/client";

export default function PublicResultPage() {
  const [roll, setRoll] = useState("");
  const [examName, setExamName] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await client.get("/public/result", { params: { roll: roll.trim(), examName: examName.trim() } });
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-result-page">
      <div className="public-result-card">
        <div className="pin-gate__brand" style={{ color: "var(--primary)", marginBottom: 4 }}>
          <span className="sidebar__brand-mark">#</span>Examination Management System
        </div>
        <h1 style={{ fontSize: 20, marginTop: 4 }}>Check Your Result</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
          Enter your roll number and the exam name exactly as announced.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="roll">Roll number</label>
            <input id="roll" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 81-7049" required />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="examName">Exam name</label>
            <input
              id="examName"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="e.g. First Terminal Examination"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Checking…" : "Check Result"}
          </button>
        </form>

        {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

        {result && (
          <div className="public-result-output">
            <div className="progress-card__header" style={{ borderRadius: 8, marginBottom: 16 }}>
              <div>
                <div className="progress-card__label">Name</div>
                <div className="progress-card__value">{result.name}</div>
              </div>
              <div>
                <div className="progress-card__label">Roll</div>
                <div className="progress-card__value">{result.roll}</div>
              </div>
              <div>
                <div className="progress-card__label">Class</div>
                <div className="progress-card__value">
                  {result.studentClass} — {result.faculty}
                </div>
              </div>
              <div>
                <div className="progress-card__label">Overall</div>
                <div className="progress-card__value">
                  {result.absent ? "AB" : `${result.percentage}% (${result.grade})`}
                </div>
              </div>
            </div>

            {!result.absent && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Theory</th>
                      <th>Practical</th>
                      <th>Grade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.marks.map((m) => (
                      <tr key={m.subject}>
                        <td>{m.subject}</td>
                        <td>
                          {m.theoryObtained}/{m.theoryFullMarks}
                        </td>
                        <td>
                          {m.practicalObtained}/{m.practicalFullMarks}
                        </td>
                        <td>
                          <span className="subject-pill">{m.grade}</span>
                        </td>
                        <td>
                          <span className={m.passed ? "status-pill status-pill--pass" : "status-pill status-pill--fail"}>
                            {m.passed ? "Pass" : "Fail"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "center" }}>
              <span
                className={result.passed ? "status-pill status-pill--pass" : "status-pill status-pill--fail"}
                style={{ fontSize: 14, padding: "6px 16px" }}
              >
                Overall: {result.passed ? "Pass" : "Fail"} · Total {result.totalObtained}/{result.totalFull} · GPA{" "}
                {result.gpa}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
