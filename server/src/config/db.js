import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/isc-app';

export async function connectDB() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`[db] connected to ${uri}`);
  } catch (err) {
    console.error(`[db] connection failed: ${err.message}`);
    console.error('[db] the API will keep running; item routes will return 503 until MongoDB is up (try: npm run db:up)');
  }
}

export function dbReady() {
  return mongoose.connection.readyState === 1;
}
