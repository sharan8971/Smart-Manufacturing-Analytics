// db.js — MongoDB connection with change stream support
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/manufacturing_db';

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

async function connectDB() {
  try {
    const conn = await mongoose.connect(MONGO_URI, options);
    console.log(`✅ MongoDB connected: ${conn.connection.host} → ${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// Change Stream: watch for low quality scores and create alerts
async function startChangeStream(db) {
  const Alert = require('./models/Alert');
  const collection = db.connection.collection('production_records');

  const pipeline = [
    {
      $match: {
        operationType: 'insert',
        'fullDocument.quality.quality_score': { $lt: 75 }
      }
    }
  ];

  const changeStream = collection.watch(pipeline, { fullDocument: 'updateLookup' });

  changeStream.on('change', async (change) => {
    const doc = change.fullDocument;
    await Alert.create({
      plant_id:    doc.plant_id,
      machine_id:  doc.machine_id,
      alert_type:  'LOW_QUALITY_SCORE',
      severity:    doc.quality.quality_score < 60 ? 'CRITICAL' : 'HIGH',
      message:     `Quality score ${doc.quality.quality_score} on machine ${doc.machine_id} (Plant ${doc.plant_id})`,
      production_date: doc.schedule.production_date
    });
    console.log(`🚨 Alert created for low quality on Plant ${doc.plant_id}`);
  });

  console.log('👁️  Change stream watching for quality alerts...');
}

module.exports = { connectDB, startChangeStream };
