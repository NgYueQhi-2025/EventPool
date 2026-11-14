import { auth, db } from '../config/firebase.js';
import { sendSuccess, sendError, formatTimestamp } from '../utils/response.js';

/**
 * GET /api/clubs
 * List all clubs
 */
export const getAllClubs = async (req, res) => {
  try {
    const snapshot = await db.collection('Clubs').get();
    const clubs = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      clubs.push({
        clubId: data.clubId || doc.id,
        clubName: data.clubName || '',
        description: data.description || '',
        contactEmail: data.contactEmail || '',
        picContactNum: data.picContactNum || '',
        isActive: data.isActive !== false
      });
    });

    return sendSuccess(res, 'Clubs retrieved successfully', clubs);
  } catch (err) {
    console.error('getAllClubs error:', err);
    return sendError(res, 'Failed to fetch clubs', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/clubs/:clubId
 * Get a specific club's details
 */
export const getClubById = async (req, res) => {
  try {
    const { clubId } = req.params;
    const docRef = db.collection('Clubs').doc(clubId);
    let docSnap = await docRef.get();

    if (!docSnap.exists) {
      const query = await db.collection('Clubs').where('clubId', '==', clubId).limit(1).get();
      if (query.empty) {
        return sendError(res, 'Club not found', 'CLUB_NOT_FOUND', 404);
      }
      docSnap = query.docs[0];
    }

    const data = docSnap.data();
    return sendSuccess(res, 'Club details retrieved successfully', {
      clubId: data.clubId || docSnap.id,
      clubName: data.clubName || '',
      description: data.description || '',
      contactEmail: data.contactEmail || '',
      picContactNum: data.picContactNum || '',
      createdAt: data.createdAt ? formatTimestamp(data.createdAt) : null,
      isActive: data.isActive !== false
    });
  } catch (err) {
    console.error('getClubById error:', err);
    return sendError(res, 'Failed to retrieve club', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/clubs/:clubId
 * Update club details. Club can only edit own profile; Admin can edit any club.
 */
export const updateClub = async (req, res) => {
  try {
    const { clubId } = req.params;

    // Authorization check
    if (req.user.role === 'club' && req.user.clubId !== clubId) {
      return sendError(res, 'Forbidden: You can only update your own club profile', 'FORBIDDEN', 403);
    }

    const docRef = db.collection('Clubs').doc(clubId);
    let docSnap = await docRef.get();
    let actualDocRef = docRef;

    if (!docSnap.exists) {
      const query = await db.collection('Clubs').where('clubId', '==', clubId).limit(1).get();
      if (query.empty) {
        return sendError(res, 'Club not found', 'CLUB_NOT_FOUND', 404);
      }
      docSnap = query.docs[0];
      actualDocRef = docSnap.ref;
    }

    const currentData = docSnap.data();
    const { clubName, description, contactEmail, picContactNum } = req.body;

    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (clubName !== undefined) updates.clubName = clubName;
    if (description !== undefined) updates.description = description;
    if (picContactNum !== undefined) updates.picContactNum = picContactNum;

    // If contact email is being updated, sync with Firebase Auth
    if (contactEmail !== undefined && contactEmail !== currentData.contactEmail) {
      const userAuthUid = currentData.authUId || currentData.authUid;
      if (userAuthUid) {
        try {
          await auth.updateUser(userAuthUid, { email: contactEmail });
        } catch (authErr) {
          if (authErr.code === 'auth/email-already-exists') {
            return sendError(res, 'Email already in use by another account', 'EMAIL_ALREADY_EXISTS', 409);
          }
          console.error('Failed to sync email to Firebase Auth:', authErr);
          return sendError(res, 'Failed to update authentication email', 'AUTH_ERROR', 400);
        }
      }
      updates.contactEmail = contactEmail;
    }

    await actualDocRef.update(updates);

    return sendSuccess(res, 'Club profile updated successfully', {
      clubId,
      clubName: updates.clubName !== undefined ? updates.clubName : currentData.clubName,
      contactEmail: updates.contactEmail !== undefined ? updates.contactEmail : currentData.contactEmail
    });
  } catch (err) {
    console.error('updateClub error:', err);
    return sendError(res, 'Failed to update club profile', 'INTERNAL_ERROR', 500);
  }
};
