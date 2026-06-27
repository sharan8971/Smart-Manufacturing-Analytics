// routes/alerts.js
// API routes for manufacturing alerts.

const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/alerts — list latest alerts
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit = 50, resolved } = req.query;
    const filter = {};

    if (resolved === "true") filter.resolved = true;
    if (resolved === "false") filter.resolved = false;

    const alerts = await Alert.find(filter)
      .sort({ created_at: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: alerts });
  })
);

// PATCH /api/alerts/:id/resolve — mark alert as resolved
router.patch(
  "/:id/resolve",
  asyncHandler(async (req, res) => {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { $set: { resolved: true } },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }

    res.json({ success: true, data: alert });
  })
);

module.exports = router;
