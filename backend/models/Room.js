const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      unique: true,
    },
    rows: {
      type: Number,
      required: [true, "Number of rows is required"],
      min: [1, "Rows must be at least 1"],
    },
    columns: {
      type: Number,
      required: [true, "Number of columns is required"],
      min: [1, "Columns must be at least 1"],
    },
  },
  { timestamps: true }
);

// Virtual for total seat capacity (rows * columns)
roomSchema.virtual("capacity").get(function () {
  return this.rows * this.columns;
});

roomSchema.set("toJSON", { virtuals: true });
roomSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Room", roomSchema);
