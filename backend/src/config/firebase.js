import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadServiceAccount() {
  // 1. Cloud / env var JSON (raw JSON string or base64-encoded JSON)
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawEnv && rawEnv.trim()) {
    try {
      const trimmed = rawEnv.trim();
      const jsonStr = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      return JSON.parse(jsonStr);
    } catch (err) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON environment variable: ${err.message}`);
    }
  }

  // 2. Discrete environment variables
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  // 3. Local serviceAccountKey.json file
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.resolve(__dirname, '../../serviceAccountKey.json'),
    path.resolve(__dirname, '../../../serviceAccountKey.json'),
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), 'backend/serviceAccountKey.json'),
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        // Continue searching
      }
    }
  }

  throw new Error(
    'Firebase credentials not found! Provide FIREBASE_SERVICE_ACCOUNT_JSON env var or place serviceAccountKey.json in backend/.'
  );
}

const serviceAccount = loadServiceAccount();
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: storageBucket || undefined,
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();
export const hasStorageBucket = Boolean(storageBucket && storageBucket.trim().length > 0);
export const bucket = hasStorageBucket ? storage.bucket() : null;

export default admin;
