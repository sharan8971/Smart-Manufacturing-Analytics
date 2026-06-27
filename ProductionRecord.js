// models/ProductionRecord.js
// Mongoose ODM schema for Manufacturing Production Records
// M.Tech Project — Smart Manufacturing Analytics System

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─────────────────────────────────────────────
// Sub-schemas (embedded documents)
// ─────────────────────────────────────────────

const ProductSchema = new Schema({
  type:               { type: String, enum: ['A', 'B', 'C', 'D'], required: true, index: true },
  raw_material_batch: { type: Number, required: true }
}, { _id: false });

const ScheduleSchema = new Schema({
  shift:           { type: String, enum: ['Morning', 'Evening', 'Night'], required: true },
  production_date: { type: Date, required: true, index: true },
  year:            { type: Number },
  month:           { type: Number },
  day:             { type: Number },
  hour:            { type: Number }
}, { _id: false });

const EnvironmentSchema = new Schema({
  temperature_c:    { type: Number, min: 0, max: 200 },
  pressure_bar:     { type: Number, min: 0 },
  humidity_percent: { type: Number, min: 0, max: 100 }
}, { _id: false });

const ProductionMetricsSchema = new Schema({
  units_produced:  { type: Number, min: 0, required: true },
  defective_units: { type: Number, min: 0, default: 0 },
  good_units:      { type: Number, min: 0 },
  defect_rate_pct: { type: Number, min: 0, max: 100 },
  cycle_time_sec:  { type: Number, min: 0 }
}, { _id: false });

const ResourceSchema = new Schema({
  energy_consumption_kwh: { type: Number, min: 0 },
  downtime_minutes:       { type: Number, min: 0, default: 0 },
  inventory_level:        { type: Number, min: 0 },
  delivery_time_hours:    { type: Number, min: 0 }
}, { _id: false });

const QualitySchema = new Schema({
  quality_score:     { type: Number, min: 0, max: 100 },
  maintenance_score: { type: Number, min: 1, max: 10 }
}, { _id: false });

const KPISchema = new Schema({
  oee_percent:  { type: Number, min: 0, max: 100 },
  availability: { type: Number, min: 0, max: 1 },
  performance:  { type: Number, min: 0, max: 1 },
  quality_rate: { type: Number, min: 0, max: 1 }
}, { _id: false });

// ─────────────────────────────────────────────
// Main Production Record Schema
// ─────────────────────────────────────────────

const ProductionRecordSchema = new Schema({
  production_id: { type: Number, required: true, unique: true },
  plant_id:      { type: Number, required: true, min: 1, max: 5 },
  machine_id:    { type: Number, required: true },
  operator_id:   { type: Number, required: true },

  product:     { type: ProductSchema,           required: true },
  schedule:    { type: ScheduleSchema,          required: true },
  environment: { type: EnvironmentSchema },
  production:  { type: ProductionMetricsSchema, required: true },
  resources:   { type: ResourceSchema },
  quality:     { type: QualitySchema },
  kpis:        { type: KPISchema },

  created_at:  { type: Date, default: Date.now },
  updated_at:  { type: Date, default: Date.now }
}, {
  collection: 'production_records',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// ─────────────────────────────────────────────
// Compound Indexes (performance optimization)
// ─────────────────────────────────────────────

// Most common query pattern: plant + date range
ProductionRecordSchema.index({ plant_id: 1, 'schedule.production_date': -1 });
// Shift analysis
ProductionRecordSchema.index({ plant_id: 1, 'schedule.shift': 1 });
// Machine performance lookup
ProductionRecordSchema.index({ machine_id: 1, 'schedule.production_date': -1 });
// Quality analysis
ProductionRecordSchema.index({ 'quality.quality_score': -1, 'production.defect_rate_pct': 1 });
// Product type + defect
ProductionRecordSchema.index({ 'product.type': 1, 'production.defect_rate_pct': -1 });
// OEE leaderboard
ProductionRecordSchema.index({ 'kpis.oee_percent': -1 });
// Operator ranking
ProductionRecordSchema.index({ operator_id: 1, 'quality.quality_score': -1 });

// ─────────────────────────────────────────────
// Virtual Fields
// ─────────────────────────────────────────────

ProductionRecordSchema.virtual('efficiency_label').get(function () {
  const oee = this.kpis?.oee_percent || 0;
  if (oee >= 85) return 'World-Class';
  if (oee >= 70) return 'Good';
  if (oee >= 60) return 'Average';
  return 'Poor';
});

ProductionRecordSchema.virtual('quality_label').get(function () {
  const qs = this.quality?.quality_score || 0;
  if (qs >= 95) return 'Excellent';
  if (qs >= 85) return 'Good';
  if (qs >= 75) return 'Acceptable';
  return 'Poor';
});

// ─────────────────────────────────────────────
// Pre-save hook: recompute derived fields
// ─────────────────────────────────────────────

ProductionRecordSchema.pre('save', function (next) {
  if (this.production) {
    const { units_produced, defective_units } = this.production;
    this.production.good_units      = units_produced - defective_units;
    this.production.defect_rate_pct = units_produced > 0
      ? parseFloat(((defective_units / units_produced) * 100).toFixed(2))
      : 0;
  }
  this.updated_at = new Date();
  next();
});

// ─────────────────────────────────────────────
// Static Methods (reusable aggregation helpers)
// ─────────────────────────────────────────────

ProductionRecordSchema.statics.getKPISummary = async function () {
  return this.aggregate([
    {
      $facet: {
        overall: [
          {
            $group: {
              _id: null,
              total_records:     { $sum: 1 },
              total_units:       { $sum: '$production.units_produced' },
              total_defective:   { $sum: '$production.defective_units' },
              avg_quality_score: { $avg: '$quality.quality_score' },
              avg_oee:           { $avg: '$kpis.oee_percent' },
              avg_energy:        { $avg: '$resources.energy_consumption_kwh' },
              avg_downtime:      { $avg: '$resources.downtime_minutes' },
              total_energy:      { $sum: '$resources.energy_consumption_kwh' }
            }
          }
        ],
        by_plant: [
          {
            $group: {
              _id:             '$plant_id',
              avg_quality:     { $avg: '$quality.quality_score' },
              avg_oee:         { $avg: '$kpis.oee_percent' },
              total_units:     { $sum: '$production.units_produced' },
              total_defective: { $sum: '$production.defective_units' }
            }
          },
          { $sort: { _id: 1 } }
        ],
        by_shift: [
          {
            $group: {
              _id:         '$schedule.shift',
              avg_quality: { $avg: '$quality.quality_score' },
              avg_oee:     { $avg: '$kpis.oee_percent' },
              count:       { $sum: 1 }
            }
          }
        ],
        by_product: [
          {
            $group: {
              _id:             '$product.type',
              avg_defect_rate: { $avg: '$production.defect_rate_pct' },
              total_units:     { $sum: '$production.units_produced' },
              avg_quality:     { $avg: '$quality.quality_score' }
            }
          },
          { $sort: { avg_defect_rate: -1 } }
        ]
      }
    }
  ]);
};

module.exports = mongoose.model('ProductionRecord', ProductionRecordSchema);
