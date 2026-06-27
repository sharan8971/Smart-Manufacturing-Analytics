// aggregations/qualityPipeline.js
// Advanced MongoDB Aggregation Pipelines for Manufacturing Analytics
// M.Tech Project — Smart Manufacturing Analytics System

const mongoose = require('mongoose');

/**
 * PIPELINE 1: Quality Score Distribution using $bucket
 * Groups quality scores into bands for histogram visualization
 */
const qualityDistributionPipeline = [
  {
    $bucket: {
      groupBy: '$quality.quality_score',
      boundaries: [0, 60, 70, 80, 90, 95, 101],
      default: 'Other',
      output: {
        count:        { $sum: 1 },
        avg_oee:      { $avg: '$kpis.oee_percent' },
        avg_defect:   { $avg: '$production.defect_rate_pct' },
        label:        { $first: { $cond: [
          { $lt: ['$quality.quality_score', 60] }, 'Critical (<60)',
          { $cond: [
            { $lt: ['$quality.quality_score', 70] }, 'Poor (60-70)',
            { $cond: [
              { $lt: ['$quality.quality_score', 80] }, 'Fair (70-80)',
              { $cond: [
                { $lt: ['$quality.quality_score', 90] }, 'Good (80-90)',
                { $cond: [
                  { $lt: ['$quality.quality_score', 95] }, 'Very Good (90-95)',
                  'Excellent (95+)'
                ]}
              ]}
            ]}
          ]}
        ]}}
      }
    }
  }
];

/**
 * PIPELINE 2: OEE by Machine with Ranking ($setWindowFields)
 * Calculates Overall Equipment Effectiveness and ranks machines
 */
const oeeMachinePipeline = [
  {
    $group: {
      _id:              '$machine_id',
      plant_id:         { $first: '$plant_id' },
      avg_oee:          { $avg: '$kpis.oee_percent' },
      avg_availability: { $avg: '$kpis.availability' },
      avg_performance:  { $avg: '$kpis.performance' },
      avg_quality_rate: { $avg: '$kpis.quality_rate' },
      total_downtime:   { $sum: '$resources.downtime_minutes' },
      total_records:    { $sum: 1 }
    }
  },
  {
    $setWindowFields: {
      sortBy: { avg_oee: -1 },
      output: {
        oee_rank: {
          $rank: {}
        }
      }
    }
  },
  {
    $addFields: {
      oee_class: {
        $switch: {
          branches: [
            { case: { $gte: ['$avg_oee', 85] }, then: 'World-Class' },
            { case: { $gte: ['$avg_oee', 70] }, then: 'Good' },
            { case: { $gte: ['$avg_oee', 60] }, then: 'Average' }
          ],
          default: 'Poor'
        }
      }
    }
  },
  { $sort: { avg_oee: -1 } },
  { $limit: 20 }
];

/**
 * PIPELINE 3: Defect Analysis by Plant + Product Type ($facet)
 * Multi-dimensional defect analysis in a single query
 */
const defectAnalysisPipeline = [
  {
    $facet: {
      // Defect rate by plant
      by_plant: [
        {
          $group: {
            _id:             '$plant_id',
            avg_defect_rate: { $avg: '$production.defect_rate_pct' },
            total_defective: { $sum: '$production.defective_units' },
            total_units:     { $sum: '$production.units_produced' }
          }
        },
        {
          $addFields: {
            overall_defect_pct: {
              $multiply: [
                { $divide: ['$total_defective', '$total_units'] },
                100
              ]
            }
          }
        },
        { $sort: { avg_defect_rate: -1 } }
      ],

      // Defect rate by product type
      by_product: [
        {
          $group: {
            _id:             '$product.type',
            avg_defect_rate: { $avg: '$production.defect_rate_pct' },
            total_defective: { $sum: '$production.defective_units' },
            count:           { $sum: 1 }
          }
        },
        { $sort: { avg_defect_rate: -1 } }
      ],

      // Defect rate by shift
      by_shift: [
        {
          $group: {
            _id:             '$schedule.shift',
            avg_defect_rate: { $avg: '$production.defect_rate_pct' },
            total_defective: { $sum: '$production.defective_units' }
          }
        }
      ],

      // Top 10 worst performing machines by defect rate
      worst_machines: [
        {
          $group: {
            _id:             '$machine_id',
            plant_id:        { $first: '$plant_id' },
            avg_defect_rate: { $avg: '$production.defect_rate_pct' },
            count:           { $sum: 1 }
          }
        },
        { $sort: { avg_defect_rate: -1 } },
        { $limit: 10 }
      ]
    }
  }
];

/**
 * PIPELINE 4: Energy Consumption Trend (monthly) with Moving Average
 */
const energyTrendPipeline = [
  {
    $group: {
      _id: {
        year:  '$schedule.year',
        month: '$schedule.month'
      },
      avg_energy:   { $avg: '$resources.energy_consumption_kwh' },
      total_energy: { $sum: '$resources.energy_consumption_kwh' },
      avg_units:    { $avg: '$production.units_produced' },
      count:        { $sum: 1 }
    }
  },
  { $sort: { '_id.year': 1, '_id.month': 1 } },
  {
    $addFields: {
      energy_per_unit: {
        $divide: ['$avg_energy', { $max: ['$avg_units', 1] }]
      },
      period: {
        $concat: [
          { $toString: '$_id.year' }, '-',
          { $toString: '$_id.month' }
        ]
      }
    }
  }
];

/**
 * PIPELINE 5: Operator Performance Leaderboard
 * Ranks operators by quality score, defect rate, and OEE
 */
const operatorLeaderboardPipeline = [
  {
    $group: {
      _id:             '$operator_id',
      avg_quality:     { $avg: '$quality.quality_score' },
      avg_oee:         { $avg: '$kpis.oee_percent' },
      avg_defect_rate: { $avg: '$production.defect_rate_pct' },
      total_units:     { $sum: '$production.units_produced' },
      total_defective: { $sum: '$production.defective_units' },
      shifts_worked:   { $sum: 1 },
      plants:          { $addToSet: '$plant_id' }
    }
  },
  {
    $addFields: {
      // Composite performance score (weighted)
      performance_score: {
        $subtract: [
          { $add: [
            { $multiply: ['$avg_quality', 0.4] },
            { $multiply: ['$avg_oee', 0.4] }
          ]},
          { $multiply: ['$avg_defect_rate', 0.2] }
        ]
      }
    }
  },
  { $sort: { performance_score: -1 } },
  { $limit: 20 },
  {
    $setWindowFields: {
      sortBy: { performance_score: -1 },
      output: { rank: { $rank: {} } }
    }
  }
];

/**
 * PIPELINE 6: Downtime Heatmap — Plant × Shift
 * Returns a matrix for visualizing downtime patterns
 */
const downtimeHeatmapPipeline = [
  {
    $group: {
      _id: {
        plant_id: '$plant_id',
        shift:    '$schedule.shift'
      },
      avg_downtime:   { $avg: '$resources.downtime_minutes' },
      total_downtime: { $sum: '$resources.downtime_minutes' },
      count:          { $sum: 1 }
    }
  },
  {
    $project: {
      _id: 0,
      plant_id:       '$_id.plant_id',
      shift:          '$_id.shift',
      avg_downtime:   { $round: ['$avg_downtime', 1] },
      total_downtime: 1,
      count:          1
    }
  },
  { $sort: { plant_id: 1, shift: 1 } }
];

/**
 * PIPELINE 7: Environmental Impact on Quality ($lookup-style correlation)
 * Buckets temperature ranges and measures quality impact
 */
const envQualityCorrelationPipeline = [
  {
    $bucket: {
      groupBy: '$environment.temperature_c',
      boundaries: [60, 70, 75, 80, 85, 90, 100],
      default: 'Out of Range',
      output: {
        count:       { $sum: 1 },
        avg_quality: { $avg: '$quality.quality_score' },
        avg_defect:  { $avg: '$production.defect_rate_pct' },
        avg_oee:     { $avg: '$kpis.oee_percent' }
      }
    }
  },
  {
    $project: {
      temp_range: '$_id',
      count: 1,
      avg_quality: { $round: ['$avg_quality', 2] },
      avg_defect:  { $round: ['$avg_defect', 2] },
      avg_oee:     { $round: ['$avg_oee', 2] }
    }
  }
];

module.exports = {
  qualityDistributionPipeline,
  oeeMachinePipeline,
  defectAnalysisPipeline,
  energyTrendPipeline,
  operatorLeaderboardPipeline,
  downtimeHeatmapPipeline,
  envQualityCorrelationPipeline
};
