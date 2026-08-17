const express = require("express");
const router = express.Router();
const {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
} = require("../controllers/roomController");
const { requireRole } = require("../middleware/auth");

router.route("/").get(getRooms).post(requireRole("admin"), createRoom);
router
  .route("/:id")
  .get(getRoom)
  .put(requireRole("admin"), updateRoom)
  .delete(requireRole("admin"), deleteRoom);

module.exports = router;
