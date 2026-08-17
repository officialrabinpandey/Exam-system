import { useEffect, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";

export default function ProgressReportPage() {
  const { showToast } = useUI();
  const [studentClass, setStudentClass] = useState("");
  const [faculty, setFaculty] = useState("");
  const [studentName, setStudentName] = useState("");
  const [faculties, setFaculties] = useState([]);
  const [studentNames, setStudentNames] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    client
      .get("/faculties")
      .then((res) => setFaculties(res.data.data))
      .catch(() => {});
    client
      .get("/students")
      .then((res) => setStudentNames([...new Set(res.data.data.map((s) => s.name))].sort()))
      .catch(() => {});
  }, []);

  const handleLoad = async () => {
    setLoading(true);
    try {
      const res = await client.get("/results/progress", {
        params: {
          studentClass: studentClass || undefined,
          faculty: faculty || undefined,
          studentName: studentName.trim() || undefined,
        },
      });
      setData(res.data.data);
      if (res.data.data.length === 0) {
        showToast("No students found for this filter", "error");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load progress report", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  // Group into class sections for display when no specific class is
  // selected — students already arrive sorted by class then name.
  const groups = (data || []).reduce((acc, row) => {
    const key = row.student.studentClass;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="main">
      <div className="page-header no-print">
        <div>
          <h1>Progress Report</h1>
          <p>Every student's full exam history — search by name, or filter by class/faculty.</p>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <div className="form-row">
            <div className="field" style={{ maxWidth: 160 }}>
              <label htmlFor="progressClass">Class</label>
              <select id="progressClass" value={studentClass} onChange={(e) => setStudentClass(e.target.value)}>
                <option value="">All classes</option>
                <option value="11">Class 11</option>
                <option value="12">Class 12</option>
              </select>
            </div>
            <div className="field" style={{ maxWidth: 200 }}>
              <label htmlFor="progressFaculty">Faculty</label>
              <select id="progressFaculty" value={faculty} onChange={(e) => setFaculty(e.target.value)}>
                <option value="">All faculties</option>
                {faculties.map((f) => (
                  <option key={f._id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="progressName">Student name</label>
              <input
                id="progressName"
                list="student-name-suggestions"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Search by name…"
              />
              <datalist id="student-name-suggestions">
                {studentNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleLoad} disabled={loading}>
              {loading ? "Loading…" : "Load Report"}
            </button>
            {data && data.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={handlePrint}>
                Print
              </button>
            )}
          </div>
        </div>
      </div>

      {data && data.length > 0 && (
        <div className="progress-report">
          {Object.keys(groups)
            .sort()
            .map((classKey) => (
              <div key={classKey} className="progress-report__class-section">
                <h2 className="progress-report__class-heading">Class {classKey}</h2>
                {groups[classKey].map((row) => (
                  <div className="progress-card" key={row.student._id}>
                    <div className="progress-card__header">
                      <div>
                        <div className="progress-card__label">Student</div>
                        <div className="progress-card__value">{row.student.name}</div>
                      </div>
                      <div>
                        <div className="progress-card__label">Roll</div>
                        <div className="progress-card__value">{row.student.roll}</div>
                      </div>
                      <div>
                        <div className="progress-card__label">Faculty</div>
                        <div className="progress-card__value">{row.student.faculty}</div>
                      </div>
                      <div>
                        <div className="progress-card__label">Overall Average</div>
                        <div className="progress-card__value">
                          {row.overallAverage !== null ? `${row.overallAverage}%` : "—"}
                        </div>
                      </div>
                    </div>

                    {row.exams.length === 0 ? (
                      <div className="empty-state">No exam results recorded yet.</div>
                    ) : (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Exam</th>
                              <th>Total</th>
                              <th>%</th>
                              <th>Grade</th>
                              <th>GPA</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.exams.map((exam) => (
                              <tr key={exam.examName}>
                                <td>{exam.examName}</td>
                                <td>
                                  {exam.totalObtained} / {exam.totalFull}
                                </td>
                                <td>{exam.percentage}%</td>
                                <td>
                                  <span className="subject-pill">{exam.grade}</span>
                                </td>
                                <td>{exam.gpa}</td>
                                <td>
                                  <span
                                    className={
                                      exam.passed
                                        ? "status-pill status-pill--pass"
                                        : "status-pill status-pill--fail"
                                    }
                                  >
                                    {exam.passed ? "Pass" : "Fail"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
