import { sendSuccess, sendError } from '../utils/response.js';

/**
 * GET /api/auth/profile
 * Returns the profile of the currently authenticated user (Admin or Club)
 */
export const getProfile = async (req, res) => {
  try {
    const { role } = req.user;

    if (role === 'club') {
      return sendSuccess(res, 'Profile retrieved successfully', {
        accountType: 'club',
        clubId: req.user.clubId,
        clubName: req.user.clubName,
        email: req.user.contactEmail
      });
    }

    if (role === 'admin') {
      return sendSuccess(res, 'Profile retrieved successfully', {
        accountType: 'admin',
        adminId: req.user.adminId,
        adminName: req.user.userName,
        email: req.user.email
      });
    }

    return sendError(res, 'Unknown account type', 'UNKNOWN_ROLE', 400);
  } catch (err) {
    console.error('getProfile error:', err);
    return sendError(res, 'Failed to fetch user profile', 'INTERNAL_ERROR', 500);
  }
};

