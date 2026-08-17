import { useEffect, useState } from "react";
import client from "../api/client";
import { useUI } from "../context/UIContext";

const emptyForm = { name: "", rows: "", columns: "" };

export default function RoomsPage() {
  const { showToast, confirm } = useUI();
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const res = await client.get("/rooms");
      setRooms(res.data.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load rooms", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, rows: Number(form.rows), columns: Number(form.columns) };
    try {
      if (editingId) {
        await client.put(`/rooms/${editingId}`, payload);
        showToast("Room updated.");
      } else {
        await client.post("/rooms", payload);
        showToast("Room added.");
      }
      setForm(emptyForm);
      setEditingId(null);
      loadRooms();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save room", "error");
    }
  };

  const handleEdit = (room) => {
    setEditingId(room._id);
    setForm({ name: room.name, rows: room.rows, columns: room.columns });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this room? This cannot be undone.");
    if (!ok) return;
    try {
      await client.delete(`/rooms/${id}`);
      showToast("Room deleted.");
      loadRooms();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete room", "error");
    }
  };

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1>Rooms</h1>
          <p>Define exam rooms by their row and column layout.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__section">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="name">Room name</label>
                <input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Hall A"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="rows">Rows</label>
                <input
                  id="rows"
                  name="rows"
                  type="number"
                  min="1"
                  value={form.rows}
                  onChange={handleChange}
                  placeholder="e.g. 6"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="columns">Columns</label>
                <input
                  id="columns"
                  name="columns"
                  type="number"
                  min="1"
                  value={form.columns}
                  onChange={handleChange}
                  placeholder="e.g. 5"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                {editingId ? "Save changes" : "Add room"}
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

      <div className="card">
        {loading ? (
          <div className="loading-state">Loading rooms…</div>
        ) : rooms.length === 0 ? (
          <div className="empty-state">No rooms yet. Add one above to get started.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Layout</th>
                <th>Capacity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r._id}>
                  <td>{r.name}</td>
                  <td>
                    {r.rows} × {r.columns}
                  </td>
                  <td>{r.rows * r.columns} seats</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => handleEdit(r)}>
                        Edit
                      </button>
                      <button className="btn btn-ghost" onClick={() => handleDelete(r._id)}>
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
