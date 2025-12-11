// lib/mongodb.ts
import { MongoClient } from 'mongodb';

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

async function getMongoClient() {
  let uri: string;

  // Use memory server for development/test
  if (process.env.USE_MEMORY_SERVER === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');

    let globalWithMemoryServer = global as typeof globalThis & {
      _memoryServer?: any;
    };

    if (!globalWithMemoryServer._memoryServer) {
      console.log('🧪 Starting MongoDB Memory Server for NextAuth...');
      globalWithMemoryServer._memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'panamia_dev',
        },
        binary: {
          version: '4.4.18', // ADD THIS LINE
        },
      });
    }

    uri = globalWithMemoryServer._memoryServer.getUri();
  } else {
    // Use real MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error(
        'Please add MONGODB_URI to .env.local or set USE_MEMORY_SERVER=true'
      );
    }
    uri = process.env.MONGODB_URI;
  }

  return new MongoClient(uri);
}

if (process.env.NODE_ENV === 'development') {
  let globalWithMongoClientPromise = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongoClientPromise._mongoClientPromise) {
    globalWithMongoClientPromise._mongoClientPromise = getMongoClient().then(
      (c) => {
        client = c;
        return client.connect();
      }
    );
  }
  clientPromise = globalWithMongoClientPromise._mongoClientPromise;
} else {
  // Production mode
  clientPromise = getMongoClient().then((c) => {
    client = c;
    return client.connect();
  });
}

export default clientPromise;
