const mongoose = require("mongoose");

// A single seat: its position in the grid and the student assigned to it (if any)
const seatSchema = new mongoose.Schema(
  {
    row: { type: Number, required: true },
    column: { type: Number, required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    // Exam-day physical attendance at this seat — distinct from a Result's
    // whole-exam "absent" flag, since this is about who actually showed up
    // to the room, marked in real time rather than when marks are entered.
    // null = not yet marked, true = present, false = marked absent.
    present: { type: Boolean, default: null },
  },
  { _id: false }
);

const seatingSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    // Stored as "YYYY-MM-DD" so date-only comparisons/filtering stay simple
    // and timezone-free.
    examDate: {
      type: String,
      required: [true, "Exam date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "examDate must be in YYYY-MM-DD format"],
    },
    rows: { type: Number, required: true },
    columns: { type: Number, required: true },
    seats: [seatSchema],
    // Invigilating teacher for this room's seating plan — assigned on generation,
    // but always manually re-editable afterward via PUT /api/seating/:id.
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    // Soft-delete flag: when a room+date plan is regenerated with `replace`,
    // the old plan is archived (not deleted) so it can be restored — an undo
    // path for accidental regeneration. Active queries exclude archived plans
    // by default.
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Seating", seatingSchema);
