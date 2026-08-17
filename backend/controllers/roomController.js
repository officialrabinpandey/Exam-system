const Room = require("../models/Room");
const Seating = require("../models/Seating");
const asyncHandler = require("../utils/asyncHandler");

// @desc    Get all rooms
// @route   GET /api/rooms
const getRooms = asyncHandler(async (req, res) => {
  const rooms = await Room.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: rooms.length, data: rooms });
});

// @desc    Get single room
// @route   GET /api/rooms/:id
const getRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, message: "Room not found" });
  }
  res.status(200).json({ success: true, data: room });
});

// @desc    Create room
// @route   POST /api/rooms
const createRoom = asyncHandler(async (req, res) => {
  const { name, rows, columns } = req.body;
  const room = await Room.create({ name, rows, columns });
  res.status(201).json({ success: true, data: room });
});

// @desc    Update room. If rows/columns are being changed and an active
//          seating plan already exists for this room, the change is blocked
//          — resizing would silently invalidate seat positions already in use.
// @route   PUT /api/rooms/:id
const updateRoom = asyncHandler(async (req, res) => {
  const { rows, columns } = req.body;
  if (rows !== undefined || columns !== undefined) {
    const activeSeating = await Seating.findOne({ room: req.params.id, archived: false });
    if (activeSeating) {
      return res.status(400).json({
        success: false,
        message: "This room has an active seating plan — delete or replace it before changing the room's layout.",
      });
    }
  }

  const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!room) {
    return res.status(404).json({ success: false, message: "Room not found" });
  }
  res.status(200).json({ success: true, data: room });
});

// @desc    Delete room — blocked if any active seating plan references it.
// @route   DELETE /api/rooms/:id
const deleteRoom = asyncHandler(async (req, res) => {
  const activeSeating = await Seating.findOne({ room: req.params.id, archived: false });
  if (activeSeating) {
    return res.status(400).json({
      success: false,
      message: "This room has an active seating plan. Delete that plan first.",
    });
  }

  const room = await Room.findByIdAndDelete(req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, message: "Room not found" });
  }
  res.status(200).json({ success: true, data: {} });
});

module.exports = {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
};
