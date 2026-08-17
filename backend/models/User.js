const mongoose = require("mongoose");

// Three roles:
// - admin: full read/write access to everything
// - viewer: read-only access to everything
// - teacher: read-only access, scoped to their own duties/schedule only
//   (enforced in controllers/frontend, tied via the `teacher` reference)
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      unique: true,
      lowercase: true,
    },
    // Optional — required only to use self-service "forgot password".
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "viewer", "teacher"],
      default: "viewer",
    },
    // Only set when role === "teacher" — links this login to their own
    // Teacher record, so they can be shown only their own duty schedule.
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
