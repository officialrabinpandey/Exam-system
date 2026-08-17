import { useState } from "react";

// Renders a seating plan as a room layout viewed from the front:
// - Columns are grouped into three zones — Door Side, Middle Row, Window Side —
//   labelled across the top, with a divider border between zones.
// - No row letters; the zone labels plus the door/window framing are enough
//   context for reading the room.
// - Click any seat to reassign which student sits there (swaps with that
//   student's previous seat, if any) — unless `attendanceMode` is on, in
//   which case a click instead cycles that seat's attendance status
//   (unmarked → present → absent → unmarked).
export default function SeatGrid({ seating, students = [], onSeatChange, attendanceMode, onAttendanceChange }) {
  const [editingKey, setEditingKey] = useState(null);

  if (!seating) return null;

  const { rows, columns, seats, room, teacher, examDate, createdAt } = seating;

  const sortedSeats = [...seats].sort((a, b) => a.row - b.row || a.column - b.column);
  const seatKey = (row, column) => `${row}-${column}`;

  const cycleAttendance = (current) => {
    if (current === null || current === undefined) return true;
    if (current === true) return false;
    return null;
  };

  const attendanceLabel = (present) => {
    if (present === true) return "Present";
    if (present === false) return "Absent";
    return "Unmarked";
  };

  // Split columns into three zones as evenly as possible
  const zoneSize = Math.ceil(columns / 3);
  const zone1End = Math.min(zoneSize, columns);
  const zone2End = Math.min(zoneSize * 2, columns);
  const zoneSizes = [zone1End, zone2End - zone1End, columns - zone2End];
  const zoneLabels = ["Door Side", "Middle Row", "Window Side"];

  const seatedElsewhere = (studentId, exceptRow, exceptColumn) =>
    seats.find(
      (s) =>
        s.student &&
        (s.student._id || s.student) === studentId &&
        !(s.row === exceptRow && s.column === exceptColumn)
    );

  const gridColumnStyle = { gridTemplateColumns: `repeat(${columns}, 108px)` };

  // Short label shown in each seat box instead of the optional subject —
  // "sci"/"mgmt" for the two built-in faculties, a generic 4-letter
  // lowercase fallback for any custom faculty added via the Faculties page.
  const facultyAbbrev = (faculty) => {
    if (!faculty) return "";
    const lower = faculty.toLowerCase();
    if (lower === "science") return "sci";
    if (lower === "management") return "mgmt";
    return lower.slice(0, 4);
  };

  return (
    <div className="seat-plan-card">
      <div className="seat-plan-header">
        <div>
          <div className="seat-plan-header__label">Room</div>
          <div className="seat-plan-header__value">{room?.name || "—"}</div>
        </div>
        <div>
          <div className="seat-plan-header__label">Invigilator</div>
          <div className="seat-plan-header__value">{teacher?.name || "Not assigned"}</div>
        </div>
        <div>
          <div className="seat-plan-header__label">Exam Date</div>
          <div className="seat-plan-header__value">{examDate || "—"}</div>
        </div>
        <div>
          <div className="seat-plan-header__label">Layout</div>
          <div className="seat-plan-header__value">
            {rows} × {columns} ({seats.length} seats)
          </div>
        </div>
      </div>

      <div className="seat-room">
        <div className="seat-room__front">Examiner's Desk / Front of Room</div>

        <div className="seat-zone-labels" style={gridColumnStyle}>
          {zoneSizes.map((size, i) =>
            size > 0 ? (
              <div
                key={i}
                className={"seat-zone-label" + (i < 2 ? " seat-zone-label--border" : "")}
                style={{ gridColumn: `span ${size}` }}
              >
                {zoneLabels[i]}
              </div>
            ) : null
          )}
        </div>

        <div className="seat-grid" style={gridColumnStyle}>
          {sortedSeats.map((seat) => {
            const key = seatKey(seat.row, seat.column);
            const isEditing = editingKey === key;
            const currentStudentId = seat.student?._id || null;
            const isZoneBorder = seat.column === zone1End || seat.column === zone2End;
            const isLastColumn = seat.column === columns;

            return (
              <div
                className={
                  "seat" +
                  (!seat.student ? " seat--empty" : "") +
                  (isZoneBorder && !isLastColumn ? " seat--zone-border" : "") +
                  (attendanceMode && seat.student ? " seat--attendance-mode" : "")
                }
                key={key}
                onClick={() => {
                  if (!seat.student) return;
                  if (attendanceMode) {
                    onAttendanceChange && onAttendanceChange(seat.row, seat.column, cycleAttendance(seat.present));
                  } else {
                    onSeatChange && setEditingKey(key);
                  }
                }}
                title={
                  attendanceMode
                    ? seat.student
                      ? `Click to cycle attendance (currently ${attendanceLabel(seat.present)})`
                      : "Empty seat"
                    : onSeatChange
                    ? "Click to reassign this seat"
                    : seat.student
                    ? `${seat.student.name} (${seat.student.roll})`
                    : "Empty seat"
                }
              >
                {seat.student && (
                  <span
                    className={
                      "seat__attendance-badge" +
                      (seat.present === true ? " seat__attendance-badge--present" : "") +
                      (seat.present === false ? " seat__attendance-badge--absent" : "")
                    }
                    title={attendanceLabel(seat.present)}
                  >
                    {seat.present === true ? "P" : seat.present === false ? "A" : "•"}
                  </span>
                )}
                {isEditing ? (
                  <select
                    autoFocus
                    className="seat__select no-print"
                    value={currentStudentId || ""}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => setEditingKey(null)}
                    onChange={(e) => {
                      const newStudentId = e.target.value || null;
                      onSeatChange(seat.row, seat.column, newStudentId);
                      setEditingKey(null);
                    }}
                  >
                    <option value="">— Empty —</option>
                    {students.map((s) => {
                      const takenElsewhere = seatedElsewhere(s._id, seat.row, seat.column);
                      return (
                        <option key={s._id} value={s._id}>
                          {s.roll} — {s.name}
                          {takenElsewhere ? " (will swap)" : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : seat.student ? (
                  <>
                    <span className="seat__roll">{seat.student.studentClass}</span>
                    <span className="seat__name">{seat.student.name}</span>
                    <span className="seat__subject">{facultyAbbrev(seat.student.faculty)}</span>
                  </>
                ) : (
                  <span>Empty</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
