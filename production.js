// routes/production.js
// CRUD routes for Production Records

const express = require('express');
const router  = express.Router();
const ProductionRecord = require('../models/ProductionRecord');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/production — paginated list with filters
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20,
    plant_id, shift, product_type,
    min_quality, max_quality,
    sort_by = 'schedule.production_date', sort_dir = '-1'
  } = req.query;

  const filter = {};
  if (plant_id)    filter.plant_id = parseInt(plant_id);
  if (shift)       filter['schedule.shift'] = shift;
  if (product_type) filter['product.type'] = product_type;
  if (min_quality || max_quality) {
    filter['quality.quality_score'] = {};
    if (min_quality) filter['quality.quality_score'].$gte = parseInt(min_quality);
    if (max_quality) filter['quality.quality_score'].$lte = parseInt(max_quality);
  }

  const sortObj = { [sort_by]: parseInt(sort_dir) };
  const skip    = (parseInt(page) - 1) * parseInt(limit);
  const total   = await ProductionRecord.countDocuments(filter);
  const records = await ProductionRecord.find(filter)
    .sort(sortObj).skip(skip).limit(parseInt(limit)).lean();

  res.json({
    success: true,
    data: records,
    pagination: {
      total, page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// GET /api/production/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const record = await ProductionRecord.findOne({ production_id: parseInt(req.params.id) }).lean();
  if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
  res.json({ success: true, data: record });
}));

// POST /api/production — insert new record
router.post('/', asyncHandler(async (req, res) => {
  const record = new ProductionRecord(req.body);
  await record.save();
  res.status(201).json({ success: true, data: record });
}));

// PATCH /api/production/:id — partial update
router.patch('/:id', asyncHandler(async (req, res) => {
  const record = await ProductionRecord.findOneAndUpdate(
    { production_id: parseInt(req.params.id) },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
  res.json({ success: true, data: record });
}));

// DELETE /api/production/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await ProductionRecord.deleteOne({ production_id: parseInt(req.params.id) });
  if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: 'Record deleted' });
}));

module.exports = router;
