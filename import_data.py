"""
import_data.py
=============
ETL Script: Manufacturing CSV → MongoDB
M.Tech Project — Smart Manufacturing Analytics System

Run: python import_data.py
Requires: pip install pymongo pandas
"""

import pandas as pd
from pymongo import MongoClient, ASCENDING, DESCENDING
from datetime import datetime
import json
import sys
import os

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
MONGO_URI = "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/smart_manufacturing"
#"mongodb://localhost:27017/"
DB_NAME   = "manufacturing_db"
COLLECTION = "production_records"
CSV_PATH  = os.path.join(os.path.dirname(__file__), "../data/Manufacturing_Dataset_1500Rows.csv")

# ─────────────────────────────────────────────
# Connect to MongoDB
# ─────────────────────────────────────────────
print("🔗 Connecting to MongoDB...")
#client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
import streamlit as st
from pymongo import MongoClient, ASCENDING, DESCENDING

# CORRECT — reads from Streamlit Secrets
client = MongoClient(st.secrets["MONGO_URI"])
db = client["smart_manufacturing"]
try:
    client.admin.command("ping")
    print("✅ Connected to MongoDB successfully")
except Exception as e:
    print(f"❌ Cannot connect to MongoDB: {e}")
    print("   Make sure mongod is running: mongod --port 27017")
    sys.exit(1)

db = client[DB_NAME]
collection = db[COLLECTION]

# ─────────────────────────────────────────────
# Load CSV
# ─────────────────────────────────────────────
print(f"\n📂 Loading CSV from: {CSV_PATH}")
df = pd.read_csv(CSV_PATH)
print(f"   Rows: {len(df)}, Columns: {len(df.columns)}")
print(f"   Columns: {list(df.columns)}")

# ─────────────────────────────────────────────
# Transform Data
# ─────────────────────────────────────────────
def transform_row(row):
    """
    Transform a flat CSV row into a rich MongoDB document.
    Nested structure enables efficient $match and $project queries.
    """
    # Parse production date
    try:
        prod_date = datetime.strptime(str(row['Production_Date']).strip(), "%Y-%m-%d %H:%M:%S")
    except:
        prod_date = datetime.now()

    # Compute derived metrics
    defect_rate = round(row['Defective_Units'] / row['Units_Produced'] * 100, 2) \
                  if row['Units_Produced'] > 0 else 0.0

    good_units = int(row['Units_Produced']) - int(row['Defective_Units'])
    
    # OEE components (simplified)
    # Availability: penalise for downtime (assume 480-min shift)
    availability = round(max(0, (480 - row['Downtime_Minutes']) / 480), 4)
    # Performance: units_produced vs theoretical max (simplified)
    theoretical_max = int(480 * 60 / max(row['Cycle_Time_Sec'], 1))
    performance = round(min(1.0, row['Units_Produced'] / theoretical_max), 4) if theoretical_max > 0 else 0
    # Quality: 1 - defect_rate
    quality_oee = round(1 - defect_rate / 100, 4)
    oee = round(availability * performance * quality_oee * 100, 2)

    return {
        # ── Identifiers ──────────────────────────────
        "production_id":    int(row['Production_ID']),
        "plant_id":         int(row['Plant_ID']),
        "machine_id":       int(row['Machine_ID']),
        "operator_id":      int(row['Operator_ID']),

        # ── Product Info ─────────────────────────────
        "product": {
            "type":              str(row['Product_Type']),
            "raw_material_batch": int(row['Raw_Material_Batch'])
        },

        # ── Schedule ─────────────────────────────────
        "schedule": {
            "shift":           str(row['Shift']),
            "production_date": prod_date,
            "year":            prod_date.year,
            "month":           prod_date.month,
            "day":             prod_date.day,
            "hour":            prod_date.hour
        },

        # ── Environmental Conditions ─────────────────
        "environment": {
            "temperature_c":    round(float(row['Temperature_C']), 2),
            "pressure_bar":     round(float(row['Pressure_Bar']), 2),
            "humidity_percent": round(float(row['Humidity_Percent']), 2)
        },

        # ── Production Metrics ───────────────────────
        "production": {
            "units_produced":   int(row['Units_Produced']),
            "defective_units":  int(row['Defective_Units']),
            "good_units":       good_units,
            "defect_rate_pct":  defect_rate,
            "cycle_time_sec":   round(float(row['Cycle_Time_Sec']), 2)
        },

        # ── Resource Consumption ─────────────────────
        "resources": {
            "energy_consumption_kwh": round(float(row['Energy_Consumption_kWh']), 2),
            "downtime_minutes":       int(row['Downtime_Minutes']),
            "inventory_level":        int(row['Inventory_Level']),
            "delivery_time_hours":    round(float(row['Delivery_Time_Hours']), 2)
        },

        # ── Quality & Maintenance ────────────────────
        "quality": {
            "quality_score":      int(row['Quality_Score']),
            "maintenance_score":  int(row['Maintenance_Score'])
        },

        # ── Computed KPIs ────────────────────────────
        "kpis": {
            "oee_percent":          oee,
            "availability":         availability,
            "performance":          performance,
            "quality_rate":         quality_oee
        },

        # ── Metadata ─────────────────────────────────
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }


print("\n🔄 Transforming data into MongoDB documents...")
documents = [transform_row(row) for _, row in df.iterrows()]
print(f"   ✅ {len(documents)} documents ready")

# ─────────────────────────────────────────────
# Insert into MongoDB
# ─────────────────────────────────────────────
# Drop existing collection for fresh import
collection.drop()
print(f"\n🗑️  Dropped existing '{COLLECTION}' collection")

print(f"📤 Inserting {len(documents)} documents into '{DB_NAME}.{COLLECTION}'...")
result = collection.insert_many(documents)
print(f"   ✅ Inserted {len(result.inserted_ids)} documents")

# ─────────────────────────────────────────────
# Create Indexes
# ─────────────────────────────────────────────
print("\n🗂️  Creating indexes...")

indexes = [
    # Single field indexes
    ([("plant_id", ASCENDING)], {}),
    ([("machine_id", ASCENDING)], {}),
    ([("operator_id", ASCENDING)], {}),
    ([("schedule.production_date", DESCENDING)], {}),
    ([("schedule.shift", ASCENDING)], {}),
    ([("product.type", ASCENDING)], {}),

    # Compound indexes for common query patterns
    ([("plant_id", ASCENDING), ("schedule.shift", ASCENDING)], {"name": "idx_plant_shift"}),
    ([("plant_id", ASCENDING), ("schedule.production_date", DESCENDING)], {"name": "idx_plant_date"}),
    ([("machine_id", ASCENDING), ("schedule.production_date", DESCENDING)], {"name": "idx_machine_date"}),
    ([("product.type", ASCENDING), ("production.defect_rate_pct", DESCENDING)], {"name": "idx_product_defect"}),
    ([("quality.quality_score", DESCENDING), ("production.defect_rate_pct", ASCENDING)], {"name": "idx_quality"}),
    ([("kpis.oee_percent", DESCENDING)], {"name": "idx_oee"}),

    # Unique index on production_id
    ([("production_id", ASCENDING)], {"unique": True, "name": "idx_prod_id_unique"}),
]

for fields, opts in indexes:
    try:
        collection.create_index(fields, **opts)
        name = opts.get("name", str([f[0] for f in fields]))
        print(f"   ✅ Index created: {name}")
    except Exception as e:
        print(f"   ⚠️  Index error: {e}")

# ─────────────────────────────────────────────
# Create Additional Collections
# ─────────────────────────────────────────────

# Alerts collection with TTL (auto-expire alerts after 30 days)
alerts_col = db["alerts"]
alerts_col.drop()
alerts_col.create_index([("created_at", ASCENDING)], expireAfterSeconds=2592000, name="ttl_alerts")
alerts_col.create_index([("plant_id", ASCENDING), ("severity", ASCENDING)])

# Sample alerts based on data
low_quality = list(collection.find(
    {"quality.quality_score": {"$lt": 80}},
    {"plant_id": 1, "machine_id": 1, "quality.quality_score": 1, "schedule.production_date": 1}
).limit(10))

alert_docs = []
for rec in low_quality:
    alert_docs.append({
        "plant_id":    rec["plant_id"],
        "machine_id":  rec["machine_id"],
        "alert_type":  "LOW_QUALITY_SCORE",
        "severity":    "HIGH",
        "message":     f"Quality score {rec['quality']['quality_score']} below threshold (80) on machine {rec['machine_id']}",
        "production_date": rec["schedule"]["production_date"],
        "resolved":    False,
        "created_at":  datetime.utcnow()
    })

if alert_docs:
    alerts_col.insert_many(alert_docs)
    print(f"\n🚨 Created {len(alert_docs)} sample alerts in 'alerts' collection")

# ─────────────────────────────────────────────
# Verification
# ─────────────────────────────────────────────
print("\n📊 Verification:")
print(f"   Total documents: {collection.count_documents({})}")
print(f"   Plants: {collection.distinct('plant_id')}")
print(f"   Product types: {collection.distinct('product.type')}")
print(f"   Shifts: {collection.distinct('schedule.shift')}")

# Sample aggregation — avg quality per plant
pipeline = [
    {"$group": {
        "_id": "$plant_id",
        "avg_quality": {"$avg": "$quality.quality_score"},
        "avg_oee":     {"$avg": "$kpis.oee_percent"},
        "total_units": {"$sum": "$production.units_produced"}
    }},
    {"$sort": {"_id": 1}}
]
print("\n   📈 Quick stats by plant:")
for r in collection.aggregate(pipeline):
    print(f"      Plant {r['_id']}: Avg Quality={r['avg_quality']:.1f}, OEE={r['avg_oee']:.1f}%, Units={r['total_units']}")

print(f"\n✅ Import complete! Database: {DB_NAME}")
print(f"   Connect with: mongosh {DB_NAME}")
client.close()
