import { useEffect, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";

export default function AuditLogPage() {
  const { showToast } = useUI();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await client.get("/audit-log");
      setEntries(res.data.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load audit log", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusClass = (code) => {
    if (code >= 200 && code < 300) return "status-pill status-pill--pass";
    return "status-pill status-pill--fail";
  };

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p>A timestamped trail of every change made in the system.</p>
        </div>
        <button className="btn btn-ghost" onClick={loadEntries}>
          Refresh
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">No activity recorded yet.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString()}</td>
                    <td>
                      <span className="subject-pill">{e.method}</span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{e.path}</td>
                    <td>
                      <span className={statusClass(e.statusCode)}>{e.statusCode}</span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
