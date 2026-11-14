import { db } from '../config/firebase.js';
import { sendSuccess, sendError, formatTimestamp } from '../utils/response.js';

/**
 * POST /api/events
 * Creates an event (Club only)
 */
export const createEvent = async (req, res) => {
  try {
    const { eventName, eventDate, purpose, description } = req.body;

    if (!eventName || !eventDate || !purpose) {
      return sendError(res, 'Missing required fields: eventName, eventDate, purpose', 'INVALID_INPUT', 400);
    }

    const clubId = req.user.clubId;
    const eventRef = db.collection('Events').doc();
    const eventId = eventRef.id;
    const createdAt = new Date().toISOString();

    const eventData = {
      eventId,
      clubId,
      eventName,
      eventDate,
      purpose,
      description: description || '',
      createdAt
    };

    await eventRef.set(eventData);

    return sendSuccess(res, 'Event created successfully', {
      eventId,
      clubId,
      eventName,
      eventDate,
      purpose
    }, 201);
  } catch (err) {
    console.error('createEvent error:', err);
    return sendError(res, 'Failed to create event', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/events
 * List events (Scoped to club's own events for club accounts; all events with filters for admins)
 */
export const getEvents = async (req, res) => {
  try {
    const { role } = req.user;
    let query = db.collection('Events');

    if (role === 'club') {
      // Clubs can only view their own events
      query = query.where('clubId', '==', req.user.clubId);
    } else if (role === 'admin') {
      // Admins can filter by clubId or eventDate
      if (req.query.clubId) {
        query = query.where('clubId', '==', req.query.clubId);
      }
      if (req.query.eventDate) {
        query = query.where('eventDate', '==', req.query.eventDate);
      }
    }

    const snapshot = await query.get();
    const events = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      events.push({
        eventId: data.eventId || doc.id,
        clubId: data.clubId,
        eventName: data.eventName,
        eventDate: data.eventDate,
        purpose: data.purpose,
        description: data.description || '',
        createdAt: formatTimestamp(data.createdAt)
      });
    });

    return sendSuccess(res, 'Events retrieved successfully', events);
  } catch (err) {
    console.error('getEvents error:', err);
    return sendError(res, 'Failed to retrieve events', 'INTERNAL_ERROR', 500);
  }
};
