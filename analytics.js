// routes/analytics.js
// Analytics REST API routes — all backed by MongoDB Aggregation Pipelines

const express = require('express');
const router  = express.Router();
const ProductionRecord = require('../models/ProductionRecord');
const {
  qualityDistributionPipeline,
  oeeMachinePipeline,
  defectAnalysisPipeline,
  energyTrendPipeline,
  operatorLeaderboardPipeline,
  downtimeHeatmapPipeline,
  envQualityCorrelationPipeline
} = require('../aggregations/pipelines');

// Helper: wrap async handlers
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ─────────────────────────────────────────────
// GET /api/analytics/summary
// KPI dashboard: $facet returns all KPIs in one query
// ─────────────────────────────────────────────
router.get('/summary', asyncHandler(async (req, res) => {
  const result = await ProductionRecord.getKPISummary();
  const data = result[0];

  const overall = data.overall[0];
  overall.overall_defect_pct = overall.total_units > 0
    ? ((overall.total_defective / overall.total_units) * 100).toFixed(2)
    : 0;

  res.json({
    success: true,
    data: {
      overall,
      by_plant:   data.by_plant,
      by_shift:   data.by_shift,
      by_product: data.by_product
    }
  });
}));

// ─────────────────────────────────────────────
// GET /api/analytics/quality-distribution
// Histogram of quality scores using $bucket
// ─────────────────────────────────────────────
router.get('/quality-distribution', asyncHandler(async (req, res) => {
  const data = await ProductionRecord.aggregate(qualityDistributionPipeline);
  res.json({ success: true, data });
}));

// ─────────────────────────────────────────────
// GET /api/analytics/oee
// OEE per machine with $rank window function
// ─────────────────────────────────────────────
router.get('/oee', asyncHandler(async (req, res) => {
  const { plant_id } = req.query;
  let pipeline = [...oeeMachinePipeline];

  if (plant_id) {
    pipeline = [{ $match: { plant_id: parseInt(plant_id) } }, ...pipeline];
  }

  const data = await ProductionRecord.aggregate(pipeline);
  res.json({ success: true, data });
}));

// ─────────────────────────────────────────────
// GET /api/analytics/defect-analysis
// Multi-faceted defect analysis
// ─────────────────────────────────────────────
router.get('/defect-analysis', asyncHandler(async (req, res) => {
  const data = await ProductionRecord.aggregate(defectAnalysisPipeline);
  res.json({ success: true, data: data[0] });
}));

// ─────────────────────────────────────────────
// GET /api/analytics/energy-trend
// Monthly energy consumption trend
// ─────────────────────────────────────────────
router.get('/energy-trend', asyncHandler(async (req, res) => {
  const data = await ProductionRecord.aggregate(energyTrendPipeline);
  res.json({ success: true, data });
}));

// ─────────────────────────────────────────────
// GET /api/analytics/top-operators
// Operator performance leaderboard
// ─────────────────────────────────────────────
router.get('/top-operators', asyncHandler(async (req, res) => {
  const data = await ProductionRecord.aggregate(operatorLeaderboardPipeline);
  res.json({ success: true, data });
}));

// ─────────────────────────────────────────────
// GET /api/analytics/downtime-heatmap
// Downtime by Plant × Shift matrix
// ─────────────────────────────────────────────
router.get('/downtime-heatmap', asyncHandler(async (req, res) => {
  const data = await ProductionRecord.aggregate(downtimeHeatmapPipeline);
  res.json({ success: true, data });
}));

// ─────────────────────────────────────────────
// GET /api/analytics/env-quality
// Temperature vs Quality correlation
// ─────────────────────────────────────────────
router.get('/env-quality', asyncHandler(async (req, res) => {
  const data = await ProductionRecord.aggregate(envQualityCorrelationPipeline);
  res.json({ success: true, data });
}));

// ─────────────────────────────────────────────
// GET /api/analytics/quality-by-shift
// Quality score breakdown per shift
// ─────────────────────────────────────────────
router.get('/quality-by-shift', asyncHandler(async (req, res) => {
  const data = await ProductionRecord.aggregate([
    {
      $group: {
        _id: {
          shift:      '$schedule.shift',
          plant_id:   '$plant_id'
        },
        avg_quality:     { $avg: '$quality.quality_score' },
        avg_defect:      { $avg: '$production.defect_rate_pct' },
        avg_oee:         { $avg: '$kpis.oee_percent' },
        count:           { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        shift:       '$_id.shift',
        plant_id:    '$_id.plant_id',
        avg_quality: { $round: ['$avg_quality', 1] },
        avg_defect:  { $round: ['$avg_defect', 2] },
        avg_oee:     { $round: ['$avg_oee', 1] },
        count: 1
      }
    },
    { $sort: { plant_id: 1, shift: 1 } }
  ]);
  res.json({ success: true, data });
}));

// Error handler
router.use((err, req, res, _next) => {
  console.error('Analytics error:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
