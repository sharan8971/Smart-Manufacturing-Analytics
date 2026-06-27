# 🏭 Smart Manufacturing Analytics System
### M.Tech Level Project — MongoDB + Node.js + React

---

## 📘 Project Overview

This project implements a **Smart Manufacturing Analytics and Monitoring System** using MongoDB as the primary NoSQL database. The system ingests real-time manufacturing production data, performs advanced aggregation analytics, and exposes REST APIs for a React dashboard.

**Dataset:** 1500 production records across 5 plants, 4 product types, 3 shifts  
**Tech Stack:** MongoDB 7, Node.js + Express, Mongoose ODM, Python (ETL), React (Dashboard)

---

## 🎯 M.Tech Research Objectives

1. **Schema Design** — Optimized NoSQL document modeling for time-series manufacturing data  
2. **Aggregation Pipelines** — Multi-stage MongoDB pipelines for KPI computation  
3. **Indexing Strategy** — Compound, TTL, and text indexes for query performance  
4. **Sharding Design** — Horizontal scalability design for production-scale data  
5. **Change Streams** — Real-time alerting on quality score drops  
6. **Predictive Analytics** — Defect rate and downtime prediction queries  

---

## 📁 Project Structure

```
manufacturing-mongodb/
├── data/
│   └── Manufacturing_Dataset_1500Rows.csv   ← Raw dataset
├── scripts/
│   ├── import_data.py                        ← ETL: CSV → MongoDB
│   ├── create_indexes.js                     ← Index creation script
│   └── seed_aggregations.js                  ← Pre-computed aggregations
├── backend/
│   ├── server.js                             ← Express entry point
│   ├── db.js                                 ← MongoDB connection
│   ├── models/
│   │   ├── ProductionRecord.js               ← Main Mongoose schema
│   │   ├── MachineHealth.js                  ← Machine health schema
│   │   └── Alert.js                          ← Alert schema
│   ├── routes/
│   │   ├── production.js                     ← CRUD + analytics routes
│   │   ├── analytics.js                      ← Aggregation pipeline routes
│   │   └── alerts.js                         ← Alert management
│   └── aggregations/
│       ├── qualityPipeline.js                ← Quality score analytics
│       ├── efficiencyPipeline.js             ← OEE & efficiency metrics
│       └── defectPipeline.js                 ← Defect analysis
├── frontend/
│   ├── package.json                          ← React/Vite dependencies
│   ├── index.html                            ← Frontend HTML entry
│   └── src/
│       ├── main.jsx                          ← React entry point
│       ├── App.jsx                           ← App component
│       ├── index.css                         ← Global styles
│       └── Dashboard.jsx                     ← React analytics dashboard
└── docs/
    └── schema_design.md                      ← Schema design document
```

---

## 🚀 Setup Instructions

### Prerequisites
- MongoDB 7.x running locally (`mongod --port 27017`)
- Node.js 18+
- Python 3.9+ with `pymongo`, `pandas`

### 1. Install Python dependencies
```bash
pip install pymongo pandas python-dateutil
```

### 2. Import data into MongoDB
```bash
cd scripts
python import_data.py
```

### 3. Create indexes
```bash
cd backend
npm install
node ../scripts/create_indexes.js
```

### 4. Start the API server
```bash
cd backend
node server.js
# Server runs at http://localhost:3001
```

### 5. Run the React dashboard
```bash
cd frontend
npm install
npm start
# Dashboard at http://localhost:3000
```

---

## 🔑 Key MongoDB Concepts Demonstrated

| Concept | Where Used |
|---|---|
| Document Schema Design | `models/ProductionRecord.js` |
| Compound Indexes | `scripts/create_indexes.js` |
| Aggregation Pipelines | `aggregations/*.js` |
| `$lookup` (Join) | Cross-collection analytics |
| `$facet` (Multi-facet) | Dashboard summary endpoint |
| `$bucket` | Quality score distribution |
| `$setWindowFields` | Moving average of defect rates |
| Change Streams | Real-time alert system |
| TTL Index | Auto-expire old alert docs |
| Atlas Search | Full-text on Product_Type |

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/production` | All records (paginated) |
| GET | `/api/production/:id` | Single record |
| POST | `/api/production` | Insert new record |
| GET | `/api/analytics/summary` | KPI dashboard summary |
| GET | `/api/analytics/quality-by-shift` | Quality scores per shift |
| GET | `/api/analytics/defect-by-plant` | Defect rates per plant |
| GET | `/api/analytics/energy-trend` | Energy consumption trend |
| GET | `/api/analytics/oee` | OEE per machine |
| GET | `/api/analytics/top-operators` | Operator performance ranking |
| GET | `/api/analytics/downtime-heatmap` | Downtime heatmap data |
| GET | `/api/alerts` | Active manufacturing alerts |

---

## 📐 Schema Design Rationale

MongoDB was chosen over RDBMS for this use case because:
- **Variable sensor readings** may differ by machine type (schema flexibility)
- **Time-series writes** are append-heavy — MongoDB's write throughput suits IoT data
- **Aggregation pipelines** natively handle multi-stage analytics without JOINs
- **Horizontal sharding** on `Plant_ID` supports future multi-site expansion
