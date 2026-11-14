/**
 * Standard API response utility functions
 */

export const sendSuccess = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
    ...(data !== null && data !== undefined ? { data } : {})
  };
  return res.status(statusCode).json(response);
};

export const sendError = (res, message, code = 'INTERNAL_ERROR', statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code
    }
  });
};

export const formatTimestamp = (val) => {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
};
