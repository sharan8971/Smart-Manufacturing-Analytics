// scripts/create_indexes.js
// Creates MongoDB indexes for the Smart Manufacturing Analytics project.

const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/manufacturing_db";

async function createIndexes() {
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  const db = mongoose.connection.db;
  const productionRecords = db.collection("production_records");
  const alerts = db.collection("alerts");

  console.log("Connected to MongoDB:", mongoose.connection.name);

  await productionRecords.createIndex(
    { production_id: 1 },
    { unique: true, name: "idx_prod_id_unique" }
  );

  await productionRecords.createIndex(
    { plant_id: 1, "schedule.production_date": -1 },
    { name: "idx_plant_date" }
  );

  await productionRecords.createIndex(
    { plant_id: 1, "schedule.shift": 1 },
    { name: "idx_plant_shift" }
  );

  await productionRecords.createIndex(
    { machine_id: 1, "schedule.production_date": -1 },
    { name: "idx_machine_date" }
  );

  await productionRecords.createIndex(
    { "product.type": 1, "production.defect_rate_pct": -1 },
    { name: "idx_product_defect" }
  );

  await productionRecords.createIndex(
    { "quality.quality_score": -1, "production.defect_rate_pct": 1 },
    { name: "idx_quality" }
  );

  await productionRecords.createIndex(
    { "kpis.oee_percent": -1 },
    { name: "idx_oee" }
  );

  await productionRecords.createIndex(
    { operator_id: 1, "quality.quality_score": -1 },
    { name: "idx_operator_quality" }
  );

  await alerts.createIndex(
    { created_at: 1 },
    { expireAfterSeconds: 2592000, name: "ttl_alerts" }
  );

  await alerts.createIndex(
    { plant_id: 1, severity: 1 },
    { name: "idx_alert_plant_severity" }
  );

  console.log("All indexes created successfully.");
}

createIndexes()
  .catch((error) => {
    console.error("Index creation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
