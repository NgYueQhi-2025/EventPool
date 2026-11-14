import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, bucket, hasStorageBucket } from '../config/firebase.js';
import { sendSuccess, sendError } from '../utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Memory storage for multer so we can validate and stream to Firebase Storage or local disk
const storageEngine = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage: storageEngine,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png'];
    if (!allowedMimes.includes(file.mimetype)) {
      const err = new Error('UNSUPPORTED_MEDIA_TYPE');
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  }
}).single('image');

// Local uploads directory fallback if no Firebase Storage bucket is provisioned
const localUploadsDir = path.resolve(__dirname, '../../uploads/resources');
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

/**
 * POST /api/resources/:resourceId/image
 */
export const uploadResourceImage = async (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 'File size exceeds 5MB limit', 'FILE_TOO_LARGE', 413);
      }
      if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        return sendError(res, 'Only image/jpeg and image/png are allowed', 'UNSUPPORTED_MEDIA_TYPE', 415);
      }
      return sendError(res, err.message || 'File upload error', 'INVALID_FILE', 400);
    }

    try {
      if (!req.file) {
        return sendError(res, 'No file provided in image field', 'INVALID_FILE', 400);
      }

      const { resourceId } = req.params;
      const docRef = db.collection('Resources').doc(resourceId);
      let docSnap = await docRef.get();
      let actualRef = docRef;

      if (!docSnap.exists) {
        const query = await db.collection('Resources').where('resourceId', '==', resourceId).limit(1).get();
        if (query.empty) {
          return sendError(res, 'Resource not found', 'RESOURCE_NOT_FOUND', 404);
        }
        docSnap = query.docs[0];
        actualRef = docSnap.ref;
      }

      const resourceData = docSnap.data();

      // Owner verification
      if (resourceData.clubId !== req.user.clubId) {
        return sendError(res, 'Forbidden: You do not own this resource', 'FORBIDDEN', 403);
      }

      const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
      const fileName = `resources/${resourceId}.${ext}`;
      let imageURL = '';

      // Check if Firebase Storage bucket is available
      if (hasStorageBucket && bucket) {
        try {
          const fileUpload = bucket.file(fileName);
          await fileUpload.save(req.file.buffer, {
            metadata: { contentType: req.file.mimetype },
            public: true
          });
          imageURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        } catch (storageError) {
          console.warn('Firebase Storage upload failed, falling back to local storage:', storageError.message);
          // Fallback to local storage below
        }
      }

      // If Firebase Storage was not used or failed (e.g. no bucket on free plan)
      if (!imageURL) {
        const localFileName = `${resourceId}.${ext}`;
        const localFilePath = path.join(localUploadsDir, localFileName);
        fs.writeFileSync(localFilePath, req.file.buffer);
        const host = req.get('host') || 'localhost:5000';
        const protocol = req.protocol || 'http';
        imageURL = `${protocol}://${host}/uploads/resources/${localFileName}`;
      }

      const now = new Date().toISOString();
      await actualRef.update({
        imageURL,
        updatedAt: now
      });

      return sendSuccess(res, 'Image uploaded successfully', {
        resourceId,
        imageURL
      });
    } catch (uploadError) {
      console.error('uploadResourceImage error:', uploadError);
      return sendError(res, 'Failed to process resource image', 'INTERNAL_ERROR', 500);
    }
  });
};

/**
 * GET /api/resources/:resourceId/image
 */
export const getResourceImage = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const docRef = db.collection('Resources').doc(resourceId);
    let docSnap = await docRef.get();

    if (!docSnap.exists) {
      const query = await db.collection('Resources').where('resourceId', '==', resourceId).limit(1).get();
      if (query.empty) {
        return sendError(res, 'Resource not found', 'RESOURCE_NOT_FOUND', 404);
      }
      docSnap = query.docs[0];
    }

    const data = docSnap.data();
    if (!data.imageURL) {
      return sendError(res, 'Resource has no image', 'IMAGE_NOT_FOUND', 404);
    }

    return sendSuccess(res, 'Image retrieved successfully', {
      resourceId,
      imageURL: data.imageURL
    });
  } catch (err) {
    console.error('getResourceImage error:', err);
    return sendError(res, 'Failed to get resource image', 'INTERNAL_ERROR', 500);
  }
};

/**
 * DELETE /api/resources/:resourceId/image
 */
export const deleteResourceImage = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const docRef = db.collection('Resources').doc(resourceId);
    let docSnap = await docRef.get();
    let actualRef = docRef;

    if (!docSnap.exists) {
      const query = await db.collection('Resources').where('resourceId', '==', resourceId).limit(1).get();
      if (query.empty) {
        return sendError(res, 'Resource not found', 'RESOURCE_NOT_FOUND', 404);
      }
      docSnap = query.docs[0];
      actualRef = docSnap.ref;
    }

    const data = docSnap.data();

    // Owner check
    if (data.clubId !== req.user.clubId) {
      return sendError(res, 'Forbidden: You do not own this resource', 'FORBIDDEN', 403);
    }

    // Try deleting from Firebase Storage if configured
    if (hasStorageBucket && bucket) {
      const extMatch = data.imageURL?.match(/\.(png|jpg|jpeg)/i);
      const ext = extMatch ? extMatch[1] : 'jpg';
      try {
        await bucket.file(`resources/${resourceId}.${ext}`).delete({ ignoreNotFound: true });
      } catch (delStorageErr) {
        console.warn('Could not delete from storage bucket:', delStorageErr.message);
      }
    }

    // Also remove local file if present
    ['png', 'jpg', 'jpeg'].forEach((ext) => {
      const localFilePath = path.join(localUploadsDir, `${resourceId}.${ext}`);
      if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch {}
      }
    });

    await actualRef.update({
      imageURL: null,
      updatedAt: new Date().toISOString()
    });

    return sendSuccess(res, 'Resource image removed successfully', {
      resourceId,
      imageURL: null
    });
  } catch (err) {
    console.error('deleteResourceImage error:', err);
    return sendError(res, 'Failed to remove resource image', 'INTERNAL_ERROR', 500);
  }
};

