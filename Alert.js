// models/Alert.js
const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  plant_id:        { type: Number, required: true, index: true },
  machine_id:      { type: Number, required: true },
  alert_type: {
    type: String,
    enum: ['LOW_QUALITY_SCORE', 'HIGH_DEFECT_RATE', 'EXCESSIVE_DOWNTIME',
           'HIGH_ENERGY', 'LOW_OEE', 'MAINTENANCE_OVERDUE'],
    required: true
  },
  severity:  { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  message:   { type: String, required: true },
  production_date: Date,
  resolved:  { type: Boolean, default: false },
  resolved_at: Date,
  created_at: { type: Date, default: Date.now }
}, { collection: 'alerts' });

// TTL index — alerts auto-expire after 30 days
AlertSchema.index({ created_at: 1 }, { expireAfterSeconds: 2592000, name: 'ttl_alerts' });
AlertSchema.index({ plant_id: 1, severity: 1 });
AlertSchema.index({ resolved: 1, created_at: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
