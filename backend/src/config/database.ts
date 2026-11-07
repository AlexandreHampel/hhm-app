
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
}
