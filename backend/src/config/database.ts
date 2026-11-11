
import mongoose from 'mongoose';

export async function connectDatabase(): Promise<void> {
  const {
    MONGO_HOST,
    MONGO_PORT,
    MONGO_DATABASE,
    MONGO_USER,
    MONGO_PASSWORD
  } = process.env;

  if (!MONGO_HOST || !MONGO_PORT || !MONGO_DATABASE ||
      !MONGO_USER || !MONGO_PASSWORD) {
    throw new Error('MongoDB environment variables are missing');
  }

  const uri = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`;

  await mongoose.connect(uri, {
    user: MONGO_USER,
    pass: MONGO_PASSWORD,
    authSource: MONGO_DATABASE
  });

  console.log('MongoDB connected successfully');

  await ensureCollectionsAndIndexes();

  console.log('MongoDB collections and indexes are ready');
}

// Creates the collections and indexes of every registered model before the API
// accepts requests. This includes the unique index on active_visits.patientId
// that guarantees a single active visit per patient, so a failed index build
// stops the startup.
async function ensureCollectionsAndIndexes(): Promise<void> {
  await Promise.all(
    mongoose.modelNames().map((name) => mongoose.model(name).init())
  );
}
