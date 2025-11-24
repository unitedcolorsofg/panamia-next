// scripts/connectdb.js - UPDATED VERSION
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);
require('dotenv/config');

console.log('USE_MEMORY_SERVER:', process.env.USE_MEMORY_SERVER);
console.log(
  'All env vars:',
  Object.keys(process.env).filter((k) => k.includes('MONGO'))
);

let globalWithMongoose = global;
if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = { conn: null, promise: null };
}
let cached = globalWithMongoose.mongoose;

if (!cached) {
  cached = globalWithMongoose.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      connectTimeoutMS: 60000,
      socketTimeoutMS: 3600000,
    };

    let mongoUri;

    // Use memory server for development/test environments
    if (process.env.USE_MEMORY_SERVER === 'true') {
      const { MongoMemoryServer } = require('mongodb-memory-server');

      // Cache the memory server instance globally
      if (!globalWithMongoose.memoryServer) {
        globalWithMongoose.memoryServer = await MongoMemoryServer.create({
          instance: {
            dbName: 'panamia_dev',
          },
          binary: {
            version: '4.4.18', // ADD THIS LINE
          },
        });
      }

      mongoUri = globalWithMongoose.memoryServer.getUri();
      console.log('🧪 Using MongoDB Memory Server:', mongoUri);
    } else {
      // Use real MongoDB for production/staging
      mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI_LIVE;

      if (!mongoUri) {
        throw new Error(
          'Please add MONGODB_URI to .env.local or set USE_MEMORY_SERVER=true'
        );
      }

      console.log('🗄️  Using MongoDB Atlas/Remote');
    }

    cached.promise = mongoose.connect(mongoUri, opts).then((mongoose) => {
      return mongoose;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = dbConnect;

// ===== CLEANUP HELPER (Optional) =====
// Call this in your test teardown or when shutting down dev server
async function dbDisconnect() {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
  }

  if (globalWithMongoose.memoryServer) {
    await globalWithMongoose.memoryServer.stop();
    globalWithMongoose.memoryServer = null;
  }
}

module.exports.dbDisconnect = dbDisconnect;
