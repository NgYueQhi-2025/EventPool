import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate serviceAccountKey.json
const candidatePaths = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  path.resolve(__dirname, '../../serviceAccountKey.json'),
  path.resolve(__dirname, '../../../serviceAccountKey.json'),
  path.resolve(process.cwd(), 'serviceAccountKey.json'),
  path.resolve(process.cwd(), 'backend/serviceAccountKey.json')
].filter(Boolean);

let serviceAccount = null;
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    try {
      const content = fs.readFileSync(p, 'utf8');
      serviceAccount = JSON.parse(content);
      break;
    } catch {
      // Continue searching
    }
  }
}

if (!serviceAccount) {
  throw new Error('serviceAccountKey.json not found! Please place it in backend/ or root directory.');
}

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: storageBucket || undefined
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();
export const hasStorageBucket = Boolean(storageBucket && storageBucket.trim().length > 0);
export const bucket = hasStorageBucket ? storage.bucket() : null;

export default admin;

