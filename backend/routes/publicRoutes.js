const express = require("express");
const router = express.Router();
const { lookupResult } = require("../controllers/publicController");
const { publicLimiter } = require("../middleware/rateLimiter");

router.get("/result", publicLimiter, lookupResult);

module.exports = router;
