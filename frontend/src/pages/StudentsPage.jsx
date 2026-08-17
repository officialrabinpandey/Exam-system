import { useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";
import { downloadCsv } from "../utils/csv";

const CLASSES = ["11", "12"];

const FILTERS = [
  { key: "all", label: "All Students" },
  { key: "11-Science", label: "Class 11 Science" },
  { key: "11-Management", label: "Class 11 Management" },
  { key: "12-Science", label: "Class 12 Science" },
  { key: "12-Management", label: "Class 12 Management" },
];

const emptyForm = {
  name: "",
  faculty: "",
  studentClass: CLASSES[0],
  optionalSubject: "",
  batchYear: "",
};

export default function StudentsPage() {
  const { showToast, confirm } = useUI();
  const [students, setStudents] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("roll");
  const [sortDir, setSortDir] = useState("asc");

  // CSV/Excel import
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null); // { data, validCount, invalidCount }
  const [importing, setImporting] = useState(false);

  // Fetches page 1 fresh (used on load and after any add/edit/delete, since
  // roll order can shift). Large rosters load 100 at a time via "Load more"
  // rather than fetching everyone in one request.
  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await client.get("/students", { params: { page: 1, limit: 100 } });
      setStudents(res.data.data);
      setPage(1);
      setTotalPages(res.data.totalPages || 1);
      setTotalCount(res.data.totalCount ?? res.data.count);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load students", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreStudents = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await client.get("/students", { params: { page: nextPage, limit: 100 } });
      setStudents((prev) => [...prev, ...res.data.data]);
      setPage(nextPage);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load more students", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadStudents();
    client
      .get("/faculties")
      .then((res) => {
        setFaculties(res.data.data);
        if (res.data.data.length > 0) {
          const first = res.data.data[0];
          setForm((f) => ({
            ...f,
            faculty: first.name,
            optionalSubject: first.electiveOptions[0] || "",
          }));
        }
      })
      .catch(() => showToast("Failed to load faculties", "error"));
  }, []);

  const selectedFacultyConfig = faculties.find((f) => f.name === form.faculty);
  const electiveOptions = selectedFacultyConfig?.electiveOptions || [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "faculty") {
      const config = faculties.find((f) => f.name === value);
      setForm({ ...form, faculty: value, optionalSubject: config?.electiveOptions[0] || "" });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      faculty: form.faculty,
      studentClass: form.studentClass,
      optionalSubject: form.optionalSubject,
      batchYear: Number(form.batchYear),
    };
    try {
      if (editingId) {
        await client.put(`/students/${editingId}`, payload);
        showToast("Student updated.");
      } else {
        await client.post("/students", payload);
        showToast("Student added.");
      }
      setForm(emptyForm);
      setEditingId(null);
      loadStudents();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save student", "error");
    }
  };

  const handleEdit = (student) => {
    setEditingId(student._id);
    setForm({
      name: student.name,
      faculty: student.faculty,
      studentClass: student.studentClass,
      optionalSubject: student.optionalSubject,
      batchYear: student.batchYear,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this student? This cannot be undone.");
    if (!ok) return;
    try {
      await client.delete(`/students/${id}`);
      showToast("Student deleted.");
      loadStudents();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete student", "error");
    }
  };

  // ---- CSV/Excel import ----

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await client.post("/students/import/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportPreview(res.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to read file", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCommitImport = async () => {
    const validRows = importPreview.data.filter((r) => r.valid);
    setImporting(true);
    try {
      const res = await client.post("/students/import/commit", { rows: validRows });
      showToast(
        `Imported ${res.data.createdCount} student(s)` +
          (res.data.failedCount ? `, ${res.data.failedCount} failed` : "")
      );
      setImportPreview(null);
      loadStudents();
    } catch (err) {
      showToast(err.response?.data?.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  // ---- Search, filter, sort ----

  const filteredStudents = useMemo(() => {
    let list =
      activeFilter === "all"
        ? students
        : students.filter((s) => `${s.studentClass}-${s.faculty}` === activeFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
      );
    }

    const sorted = [...list].sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return sorted;
  }, [students, activeFilter, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleExport = () => {
    downloadCsv(
      "students.csv",
      filteredStudents.map((s) => ({
        Roll: s.roll,
        Name: s.name,
        Faculty: s.faculty,
        Class: s.studentClass,
        "Optional Subject": s.optionalSubject,
        "Batch Year": s.batchYear,
      }))
    );
  };

  const sortArrow = (key) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1>Students</h1>
          <p>Manage the student roster used to build seating plans.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
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
                  placeholder="e.g. Ram Thapa"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="faculty">Faculty</label>
                <select id="faculty" name="faculty" value={form.faculty} onChange={handleChange} required>
                  {faculties.length === 0 && <option value="">No faculties configured</option>}
                  {faculties.map((f) => (
                    <option key={f._id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="studentClass">Class</label>
                <select
                  id="studentClass"
                  name="studentClass"
                  value={form.studentClass}
                  onChange={handleChange}
                >
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </div>
              {electiveOptions.length > 0 && (
                <div className="field">
                  <label htmlFor="optionalSubject">
                    {selectedFacultyConfig?.electiveGroupName || "Optional subject"}
                  </label>
                  <select
                    id="optionalSubject"
                    name="optionalSubject"
                    value={form.optionalSubject}
                    onChange={handleChange}
                  >
                    {electiveOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="batchYear">Batch year</label>
                <input
                  id="batchYear"
                  name="batchYear"
                  type="number"
                  value={form.batchYear}
                  onChange={handleChange}
                  placeholder="e.g. 2081"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                {editingId ? "Save changes" : "Add student"}
              </button>
              {editingId && (
                <button type="button" className="btn btn-ghost" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
            {!editingId && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
                Roll number is generated automatically as &lt;batch year&gt;-&lt;sequence&gt;,
                e.g. 81-7049 for batch 2081.
              </p>
            )}
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <div className="form-row" style={{ alignItems: "center" }}>
            <div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? "Reading…" : "Import CSV/Excel"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={handleFileSelected}
              />
            </div>
            <button type="button" className="btn btn-ghost" onClick={handleExport}>
              Export CSV
            </button>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Import expects columns: name, faculty, class, optionalSubject, batchYear.
            </p>
          </div>

          {importPreview && (
            <div className="import-preview">
              <div className="import-preview__summary">
                {importPreview.validCount} of {importPreview.count} rows are valid.
                {importPreview.invalidCount > 0 &&
                  ` ${importPreview.invalidCount} row(s) will be skipped.`}
              </div>
              <div className="table-scroll" style={{ maxHeight: 260, overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Faculty</th>
                      <th>Class</th>
                      <th>Optional</th>
                      <th>Batch</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.data.map((r) => (
                      <tr key={r.row} className={r.valid ? "" : "import-row--invalid"}>
                        <td>{r.row}</td>
                        <td>{r.name}</td>
                        <td>{r.faculty}</td>
                        <td>{r.studentClass}</td>
                        <td>{r.optionalSubject}</td>
                        <td>{r.batchYear}</td>
                        <td>
                          {r.valid ? (
                            <span className="subject-pill">OK</span>
                          ) : (
                            <span title={r.errors.join("; ")}>⚠ {r.errors[0]}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row-actions" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleCommitImport}
                  disabled={importing || importPreview.validCount === 0}
                >
                  {importing ? "Importing…" : `Import ${importPreview.validCount} student(s)`}
                </button>
                <button className="btn btn-ghost" onClick={() => setImportPreview(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={"filter-btn" + (activeFilter === f.key ? " active" : "")}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <input
          className="search-input"
          list="student-search-suggestions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or roll…"
        />
        <datalist id="student-search-suggestions">
          {[...new Set(students.map((s) => s.name))].sort().map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">Loading students…</div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state">
            {students.length === 0
              ? "No students yet. Add one above to get started."
              : "No students match this filter/search."}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>S.N.</th>
                  <th className="sortable" onClick={() => toggleSort("roll")}>
                    Roll{sortArrow("roll")}
                  </th>
                  <th className="sortable" onClick={() => toggleSort("name")}>
                    Name{sortArrow("name")}
                  </th>
                  <th>Faculty</th>
                  <th>Class</th>
                  <th>Optional subject</th>
                  <th>Batch</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, i) => (
                  <tr key={s._id}>
                    <td>{i + 1}</td>
                    <td>
                      <span className="roll-tag">{s.roll}</span>
                    </td>
                    <td>{s.name}</td>
                    <td>{s.faculty}</td>
                    <td>{s.studentClass}</td>
                    <td>
                      <span className="subject-pill">{s.optionalSubject}</span>
                    </td>
                    <td>{s.batchYear}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-ghost" onClick={() => handleEdit(s)}>
                          Edit
                        </button>
                        <button className="btn btn-ghost" onClick={() => handleDelete(s._id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {page < totalPages && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={loadMoreStudents} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Load more (${students.length} of ${totalCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
