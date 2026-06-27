# MongoDB Schema Design Document
## Smart Manufacturing Analytics System
### M.Tech Project Report — Database Design

---

## 1. Design Philosophy

This system uses **MongoDB's document model** to represent manufacturing production records. Unlike relational tables, the document model allows related data to be co-located in the same document, eliminating JOINs for the most frequent read patterns.

**Key design decision:** Embed all per-production-run data in a single document. Reference collections (alerts, machine health) are kept separate as they grow independently.

---

## 2. Document Structure

### Collection: `production_records`

Each document represents one production run (one CSV row):

```json
{
  "_id": ObjectId("..."),
  "production_id": 1,
  "plant_id": 4,
  "machine_id": 131,
  "operator_id": 1004,

  "product": {
    "type": "D",
    "raw_material_batch": 5799
  },

  "schedule": {
    "shift": "Evening",
    "production_date": ISODate("2025-01-01T00:00:00Z"),
    "year": 2025,
    "month": 1,
    "day": 1,
    "hour": 0
  },

  "environment": {
    "temperature_c": 80.19,
    "pressure_bar": 12.85,
    "humidity_percent": 52.17
  },

  "production": {
    "units_produced": 264,
    "defective_units": 7,
    "good_units": 257,
    "defect_rate_pct": 2.65,
    "cycle_time_sec": 147.21
  },

  "resources": {
    "energy_consumption_kwh": 270.69,
    "downtime_minutes": 17,
    "inventory_level": 405,
    "delivery_time_hours": 26.59
  },

  "quality": {
    "quality_score": 95,
    "maintenance_score": 5
  },

  "kpis": {
    "oee_percent": 58.4,
    "availability": 0.9646,
    "performance": 0.6432,
    "quality_rate": 0.9735
  },

  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

---

## 3. Index Strategy

### 3.1 Index Summary Table

| Index Name | Fields | Type | Purpose |
|---|---|---|---|
| `idx_prod_id_unique` | `production_id` | Unique | PK-style lookup |
| `idx_plant_date` | `plant_id, schedule.production_date` | Compound | Plant time-series queries |
| `idx_plant_shift` | `plant_id, schedule.shift` | Compound | Shift analytics per plant |
| `idx_machine_date` | `machine_id, schedule.production_date` | Compound | Machine history |
| `idx_product_defect` | `product.type, production.defect_rate_pct` | Compound | Product defect reports |
| `idx_quality` | `quality.quality_score, production.defect_rate_pct` | Compound | Quality-based queries |
| `idx_oee` | `kpis.oee_percent` | Single | OEE leaderboard |
| `ttl_alerts` | `alerts.created_at` | TTL | Auto-expire old alerts |

### 3.2 Index Selectivity Analysis

- `plant_id` has 5 distinct values → low selectivity alone, always paired with date
- `machine_id` has ~50 distinct values → medium selectivity
- `production_id` is unique → highest selectivity, used for exact lookups
- `quality.quality_score` ranges 60–100 → effective for range queries

---

## 4. Aggregation Pipeline Patterns

### 4.1 $facet — Multi-Dimensional Dashboard

The `/api/analytics/summary` endpoint uses `$facet` to compute 4 different groupings in **one query pass**:

```javascript
db.production_records.aggregate([
  { $facet: {
      overall:    [ { $group: { _id: null, ... } } ],
      by_plant:   [ { $group: { _id: "$plant_id", ... } }, { $sort: { _id: 1 } } ],
      by_shift:   [ { $group: { _id: "$schedule.shift", ... } } ],
      by_product: [ { $group: { _id: "$product.type", ... } }, { $sort: { avg_defect_rate: -1 } } ]
  }}
])
```

**Why `$facet`?** Without it, 4 separate queries would be needed. `$facet` runs all sub-pipelines on the same input set.

### 4.2 $bucket — Quality Score Histogram

```javascript
db.production_records.aggregate([
  { $bucket: {
      groupBy: "$quality.quality_score",
      boundaries: [0, 60, 70, 80, 90, 95, 101],
      output: {
        count:      { $sum: 1 },
        avg_oee:    { $avg: "$kpis.oee_percent" },
        avg_defect: { $avg: "$production.defect_rate_pct" }
      }
  }}
])
```

### 4.3 $setWindowFields — Machine Ranking

```javascript
db.production_records.aggregate([
  { $group: { _id: "$machine_id", avg_oee: { $avg: "$kpis.oee_percent" } } },
  { $setWindowFields: {
      sortBy: { avg_oee: -1 },
      output: { oee_rank: { $rank: {} } }
  }}
])
```

`$setWindowFields` is a MongoDB 5.0+ feature enabling OLAP-style window functions (RANK, DENSE_RANK, moving averages) directly in the aggregation pipeline.

### 4.4 Moving Average of Defect Rate (Time Series)

```javascript
db.production_records.aggregate([
  { $sort: { "schedule.production_date": 1 } },
  { $setWindowFields: {
      sortBy: { "schedule.production_date": 1 },
      output: {
        moving_avg_defect: {
          $avg: "$production.defect_rate_pct",
          window: { documents: [-6, 0] }   // 7-point moving average
        }
      }
  }}
])
```

---

## 5. Change Streams (Real-Time Alerting)

MongoDB Change Streams (requires replica set) watch for quality score drops:

```javascript
const stream = db.production_records.watch([
  { $match: {
      operationType: "insert",
      "fullDocument.quality.quality_score": { $lt: 75 }
  }}
]);

stream.on("change", (change) => {
  // Auto-insert alert document
  db.alerts.insertOne({ severity: "HIGH", ... });
});
```

---

## 6. Sharding Design (Scale-Out)

For a production-scale system with millions of records, sharding on `plant_id`:

```javascript
sh.enableSharding("manufacturing_db");
sh.shardCollection(
  "manufacturing_db.production_records",
  { plant_id: 1, "schedule.production_date": 1 }  // compound shard key
);
```

**Rationale:** Queries filter on `plant_id` most frequently. Compound key on date prevents hot spots from all new inserts going to one shard.

---

## 7. Performance Benchmarks (Estimated)

| Query | Without Index | With Index |
|---|---|---|
| Find by `production_id` | O(n) = 1500ms | O(1) = 1ms |
| Plant-filtered queries | 45ms | 3ms |
| Quality score range | 38ms | 5ms |
| Full aggregation summary | 120ms | 40ms |

---

## 8. Comparison: MongoDB vs RDBMS for this use case

| Aspect | MongoDB | PostgreSQL |
|---|---|---|
| Schema flexibility | ✅ Add sensor fields per machine | ❌ ALTER TABLE required |
| Write throughput | ✅ High (journal writes) | ⚠️ ACID overhead |
| Aggregation pipelines | ✅ Native multi-stage | ⚠️ Complex CTEs needed |
| Horizontal scaling | ✅ Built-in sharding | ❌ Application-level |
| Full-text search | ✅ Atlas Search | ✅ tsvector |
| ACID transactions | ✅ Multi-doc (v4.0+) | ✅ Native |
| Time series | ✅ Native TS collections (v5.1+) | ⚠️ TimescaleDB extension |

**Conclusion:** MongoDB's aggregation pipeline and document model provide a better fit for manufacturing IoT analytics than a traditional RDBMS, particularly when data schema evolves as new sensor types are added to machines.
