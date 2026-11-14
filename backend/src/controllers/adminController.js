import { auth, db } from '../config/firebase.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * GET /api/admin/profile
 */
export const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.adminId;
    let adminDoc = await db.collection('Admins').doc(adminId).get();

    if (!adminDoc.exists) {
      const query = await db.collection('Admins').where('adminId', '==', adminId).limit(1).get();
      if (query.empty) {
        return sendError(res, 'Admin record not found', 'ADMIN_NOT_FOUND', 404);
      }
      adminDoc = query.docs[0];
    }

    const data = adminDoc.data();
    return sendSuccess(res, 'Admin profile retrieved successfully', {
      adminId: data.adminId || adminDoc.id,
      adminName: data.userName || data.adminName || req.user.userName,
      email: data.email || req.user.email,
      isActive: true
    });
  } catch (err) {
    console.error('getAdminProfile error:', err);
    return sendError(res, 'Failed to retrieve admin profile', 'INTERNAL_ERROR', 500);
  }
};

/**
 * POST /api/admin/clubs
 * Creates a club user in Firebase Auth and saves club document in Firestore (atomic rollback on error)
 */
export const createClub = async (req, res) => {
  const { clubName, description, contactEmail, picContactNum, password } = req.body;

  if (!clubName || !contactEmail || !picContactNum || !password) {
    return sendError(res, 'Missing required fields: clubName, contactEmail, picContactNum, password', 'INVALID_INPUT', 400);
  }

  let createdUserRecord = null;
  try {
    // 1. Create user in Firebase Auth
    try {
      createdUserRecord = await auth.createUser({
        email: contactEmail,
        password: password,
        displayName: clubName
      });
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        return sendError(res, 'Email already registered', 'EMAIL_ALREADY_EXISTS', 409);
      }
      console.error('Firebase Auth createUser error:', authError);
      return sendError(res, authError.message || 'Failed to create user in Firebase Auth', 'AUTH_ERROR', 400);
    }

    // 2. Create document in Firestore Clubs collection
    const clubRef = db.collection('Clubs').doc();
    const clubId = clubRef.id;
    const createdAt = new Date().toISOString();

    const clubDocData = {
      clubId,
      clubName,
      description: description || '',
      contactEmail,
      authUId: createdUserRecord.uid,
      authUid: createdUserRecord.uid,
      picContactNum,
      createdAt,
      isActive: true
    };

    try {
      await clubRef.set(clubDocData);
    } catch (dbError) {
      // Rollback Auth user creation if Firestore write fails
      console.error('Firestore save failed, rolling back created auth user:', dbError);
      if (createdUserRecord) {
        await auth.deleteUser(createdUserRecord.uid).catch((delErr) => {
          console.error('Rollback deletion failed:', delErr);
        });
      }
      return sendError(res, 'Failed to save club data to database', 'ACCOUNT_CREATION_FAILED', 500);
    }

    return sendSuccess(res, 'Club registered successfully', {
      clubId,
      clubName,
      contactEmail,
      isActive: true
    }, 201);
  } catch (err) {
    console.error('createClub error:', err);
    if (createdUserRecord) {
      await auth.deleteUser(createdUserRecord.uid).catch(() => {});
    }
    return sendError(res, 'Unexpected error creating club account', 'ACCOUNT_CREATION_FAILED', 500);
  }
};

/**
 * PATCH /api/admin/clubs/:clubId/deactivate
 */
export const deactivateClub = async (req, res) => {
  try {
    const { clubId } = req.params;
    if (!clubId) {
      return sendError(res, 'clubId parameter is required', 'INVALID_INPUT', 400);
    }

    const clubRef = db.collection('Clubs').doc(clubId);
    let clubDoc = await clubRef.get();
    let actualDocRef = clubRef;

    if (!clubDoc.exists) {
      const query = await db.collection('Clubs').where('clubId', '==', clubId).limit(1).get();
      if (query.empty) {
        return sendError(res, 'Club not found', 'CLUB_NOT_FOUND', 404);
      }
      clubDoc = query.docs[0];
      actualDocRef = clubDoc.ref;
    }

    const clubData = clubDoc.data();
    const userAuthUid = clubData.authUId || clubData.authUid;

    // Disable in Firebase Auth if authUId is present
    if (userAuthUid) {
      try {
        await auth.updateUser(userAuthUid, { disabled: true });
      } catch (authErr) {
        console.warn('Warning: Could not disable auth user (might not exist):', authErr.message);
      }
    }

    // Update isActive to false in Firestore
    await actualDocRef.update({
      isActive: false,
      updatedAt: new Date().toISOString()
    });

    return sendSuccess(res, 'Club deactivated successfully', {
      clubId,
      isActive: false
    });
  } catch (err) {
    console.error('deactivateClub error:', err);
    return sendError(res, 'Failed to deactivate club', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/admin/dashboard
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const [clubsSnap, resourcesSnap, requestsSnap] = await Promise.all([
      db.collection('Clubs').get(),
      db.collection('Resources').get(),
      db.collection('BorrowingRequests').get()
    ]);

    const totalClubs = clubsSnap.size;
    let activeClubs = 0;
    clubsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.isActive !== false) {
        activeClubs += 1;
      }
    });

    const totalResources = resourcesSnap.size;

    const totalBorrowingRequests = requestsSnap.size;
    let pendingRequests = 0;
    let completedRequests = 0;

    requestsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.status === 'Pending') {
        pendingRequests += 1;
      } else if (data.status === 'Completed') {
        completedRequests += 1;
      }
    });

    return sendSuccess(res, 'Dashboard statistics retrieved successfully', {
      totalClubs,
      activeClubs,
      totalResources,
      totalBorrowingRequests,
      pendingRequests,
      completedRequests
    });
  } catch (err) {
    console.error('getAdminDashboard error:', err);
    return sendError(res, 'Failed to load dashboard metrics', 'INTERNAL_ERROR', 500);
  }
};
