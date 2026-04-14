import mongoose from 'mongoose';
import { env } from '../config/env.js';

let isConnected = false;

export async function connectMongo(): Promise<void> {
  if (isConnected) {
    return;
  }

  if (!env.mongodbUri) {
    console.warn('MongoDB URI is not configured. Identity features will be unavailable.');
    return;
  }

  await mongoose.connect(env.mongodbUri, {
    dbName: env.mongodbDbName
  });

  isConnected = true;
  console.log(`MongoDB connected (${env.mongodbDbName})`);
}

export function isMongoConfigured(): boolean {
  return Boolean(env.mongodbUri);
}
