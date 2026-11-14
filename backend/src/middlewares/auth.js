import { auth, db } from '../config/firebase.js';
import { sendError } from '../utils/response.js';

/**
 * Authentication middleware that verifies Firebase ID token and resolves user role from Firestore
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authorization header missing or malformed', 'UNAUTHORIZED', 401);
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!token) {
      return sendError(res, 'Bearer token missing', 'UNAUTHORIZED', 401);
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (err) {
      return sendError(res, 'Invalid or expired authentication token', 'UNAUTHORIZED', 401);
    }

    const { uid } = decodedToken;

    // 1. Check Admins collection (check by doc ID or adminId field)
    const adminDocRef = db.collection('Admins').doc(uid);
    const adminDocSnap = await adminDocRef.get();

    if (adminDocSnap.exists) {
      const adminData = adminDocSnap.data();
      req.user = {
        role: 'admin',
        adminId: adminData.adminId || adminDocSnap.id,
        email: adminData.email || decodedToken.email,
        userName: adminData.userName || adminData.adminName || 'System Administrator'
      };
      return next();
    }

    // Admins query fallback in case doc ID != adminId
    const adminQuery = await db.collection('Admins').where('adminId', '==', uid).limit(1).get();
    if (!adminQuery.empty) {
      const adminData = adminQuery.docs[0].data();
      req.user = {
        role: 'admin',
        adminId: adminData.adminId || adminQuery.docs[0].id,
        email: adminData.email || decodedToken.email,
        userName: adminData.userName || adminData.adminName || 'System Administrator'
      };
      return next();
    }

    // 2. Check Clubs collection (check by authUId or authUid)
    let clubQuery = await db.collection('Clubs').where('authUId', '==', uid).limit(1).get();
    if (clubQuery.empty) {
      clubQuery = await db.collection('Clubs').where('authUid', '==', uid).limit(1).get();
    }

    if (!clubQuery.empty) {
      const clubDoc = clubQuery.docs[0];
      const clubData = clubDoc.data();

      // Check if club is active
      if (clubData.isActive === false) {
        return sendError(res, 'Account is disabled', 'ACCOUNT_DISABLED', 403);
      }

      req.user = {
        role: 'club',
        clubId: clubData.clubId || clubDoc.id,
        clubName: clubData.clubName,
        contactEmail: clubData.contactEmail
      };
      return next();
    }

    // Fallback: check Clubs doc by ID
    const clubDocSnap = await db.collection('Clubs').doc(uid).get();
    if (clubDocSnap.exists) {
      const clubData = clubDocSnap.data();
      if (clubData.isActive === false) {
        return sendError(res, 'Account is disabled', 'ACCOUNT_DISABLED', 403);
      }
      req.user = {
        role: 'club',
        clubId: clubData.clubId || clubDocSnap.id,
        clubName: clubData.clubName,
        contactEmail: clubData.contactEmail
      };
      return next();
    }

    // UID not found in Admins or Clubs
    return sendError(res, 'Account profile not found', 'ACCOUNT_PROFILE_NOT_FOUND', 404);
  } catch (err) {
    console.error('Authentication middleware error:', err);
    return sendError(res, 'Failed to authenticate request', 'INTERNAL_ERROR', 500);
  }
};

/**
 * Role guard: Require Admin role
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, 'Forbidden: Admin access required', 'FORBIDDEN', 403);
  }
  next();
};

/**
 * Role guard: Require Club role
 */
export const requireClub = (req, res, next) => {
  if (!req.user || req.user.role !== 'club') {
    return sendError(res, 'Forbidden: Club access required', 'FORBIDDEN', 403);
  }
  next();
};
