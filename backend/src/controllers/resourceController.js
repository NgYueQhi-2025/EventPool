import { db } from '../config/firebase.js';
import { sendSuccess, sendError, formatTimestamp } from '../utils/response.js';

/**
 * Computes resource status according to business logic:
 * - isTemporarilyUnavailable === true -> 'Unavailable'
 * - availableQuantity > 0 -> 'Available'
 * - reservedQuantity > 0 -> 'Reserved'
 * - else -> 'Borrowed'
 */
export const computeResourceStatus = (resource) => {
  if (resource.isTemporarilyUnavailable === true) {
    return 'Unavailable';
  }
  if (Number(resource.availableQuantity) > 0) {
    return 'Available';
  }
  if (Number(resource.reservedQuantity) > 0) {
    return 'Reserved';
  }
  return 'Borrowed';
};

/**
 * Helper to get the list of active club IDs to filter resources
 */
const getActiveClubIds = async () => {
  const clubsSnap = await db.collection('Clubs').get();
  const activeIds = new Set();
  clubsSnap.forEach((doc) => {
    const data = doc.data();
    const clubId = data.clubId || doc.id;
    if (data.isActive !== false) {
      activeIds.add(clubId);
    }
  });
  return activeIds;
};

/**
 * POST /api/resources
 * Create a new resource (Club only)
 */
export const createResource = async (req, res) => {
  try {
    const {
      itemName,
      category,
      description,
      totalQuantity,
      condition,
      location,
      remarks,
      estimatedUnitCost,
      estimatedUnitWeight
    } = req.body;

    const parsedQty = parseInt(totalQuantity, 10);
    if (!itemName || !category || isNaN(parsedQty) || parsedQty <= 0) {
      return sendError(res, 'Invalid input: itemName, category, and positive totalQuantity are required', 'INVALID_INPUT', 400);
    }

    const clubId = req.user.clubId;
    const resourceRef = db.collection('Resources').doc();
    const resourceId = resourceRef.id;
    const now = new Date().toISOString();

    const resourceData = {
      resourceId,
      clubId,
      itemName,
      category,
      description: description || '',
      totalQuantity: parsedQty,
      availableQuantity: parsedQty,
      reservedQuantity: 0,
      borrowedQuantity: 0,
      condition: condition || 'Good',
      location: location || '',
      remarks: remarks || '',
      estimatedUnitCost: estimatedUnitCost !== undefined ? Number(estimatedUnitCost) : 0,
      estimatedUnitWeight: estimatedUnitWeight !== undefined ? Number(estimatedUnitWeight) : 0,
      status: 'Available',
      imageURL: null,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: now,
      updatedAt: now
    };

    resourceData.status = computeResourceStatus(resourceData);

    await resourceRef.set(resourceData);

    return sendSuccess(res, 'Resource created successfully', resourceData, 201);
  } catch (err) {
    console.error('createResource error:', err);
    return sendError(res, 'Failed to create resource', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/resources
 * Retrieve resources with filtering and pagination (excludes archived & inactive clubs)
 */
export const getResources = async (req, res) => {
  try {
    const { category, status, clubId, location } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);

    const activeClubIds = await getActiveClubIds();
    const snapshot = await db.collection('Resources').get();

    let items = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const rId = data.resourceId || doc.id;
      const item = {
        ...data,
        resourceId: rId,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt)
      };

      // Exclude archived resources
      if (item.isArchived === true) return;

      // Exclude resources belonging to inactive clubs
      if (!activeClubIds.has(item.clubId)) return;

      // Calculate live status dynamically
      item.status = computeResourceStatus(item);

      // Apply query filters
      if (category && item.category !== category) return;
      if (status && item.status !== status) return;
      if (clubId && item.clubId !== clubId) return;
      if (location && (!item.location || !item.location.toLowerCase().includes(location.toLowerCase()))) return;

      items.push(item);
    });

    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return sendSuccess(res, 'Resources retrieved successfully', {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('getResources error:', err);
    return sendError(res, 'Failed to fetch resources', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/resources/search
 * Keyword search on itemName and description + filters and pagination
 */
export const searchResources = async (req, res) => {
  try {
    const { q, category, status, clubId, location } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);

    const activeClubIds = await getActiveClubIds();
    const snapshot = await db.collection('Resources').get();

    let items = [];
    const queryTerm = q ? q.toLowerCase().trim() : '';

    snapshot.forEach((doc) => {
      const data = doc.data();
      const rId = data.resourceId || doc.id;
      const item = {
        ...data,
        resourceId: rId,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt)
      };

      if (item.isArchived === true) return;
      if (!activeClubIds.has(item.clubId)) return;

      item.status = computeResourceStatus(item);

      // Search keyword matching
      if (queryTerm) {
        const nameMatch = item.itemName && item.itemName.toLowerCase().includes(queryTerm);
        const descMatch = item.description && item.description.toLowerCase().includes(queryTerm);
        if (!nameMatch && !descMatch) return;
      }

      // Filter matching
      if (category && item.category !== category) return;
      if (status && item.status !== status) return;
      if (clubId && item.clubId !== clubId) return;
      if (location && (!item.location || !item.location.toLowerCase().includes(location.toLowerCase()))) return;

      items.push(item);
    });

    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return sendSuccess(res, 'Search results retrieved successfully', {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('searchResources error:', err);
    return sendError(res, 'Failed to search resources', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/resources/:resourceId
 * Get single resource details
 */
export const getResourceById = async (req, res) => {
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
    const item = {
      ...data,
      resourceId: data.resourceId || docSnap.id,
      createdAt: formatTimestamp(data.createdAt),
      updatedAt: formatTimestamp(data.updatedAt),
      status: computeResourceStatus(data)
    };

    return sendSuccess(res, 'Resource details retrieved successfully', item);
  } catch (err) {
    console.error('getResourceById error:', err);
    return sendError(res, 'Failed to fetch resource', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/resources/:resourceId
 * Update resource details (Club owner only)
 */
export const updateResource = async (req, res) => {
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

    const current = docSnap.data();

    // Owner check: must belong to authenticated club
    if (current.clubId !== req.user.clubId) {
      return sendError(res, 'Forbidden: You do not own this resource', 'FORBIDDEN', 403);
    }

    const {
      itemName,
      category,
      description,
      totalQuantity,
      condition,
      location,
      remarks,
      estimatedUnitCost,
      estimatedUnitWeight
    } = req.body;

    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (itemName !== undefined) updates.itemName = itemName;
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (condition !== undefined) updates.condition = condition;
    if (location !== undefined) updates.location = location;
    if (remarks !== undefined) updates.remarks = remarks;
    if (estimatedUnitCost !== undefined) updates.estimatedUnitCost = Number(estimatedUnitCost);
    if (estimatedUnitWeight !== undefined) updates.estimatedUnitWeight = Number(estimatedUnitWeight);

    let reservedQty = Number(current.reservedQuantity) || 0;
    let borrowedQty = Number(current.borrowedQuantity) || 0;

    if (totalQuantity !== undefined) {
      const parsedTotal = parseInt(totalQuantity, 10);
      if (isNaN(parsedTotal) || parsedTotal <= 0) {
        return sendError(res, 'totalQuantity must be a positive integer', 'INVALID_INPUT', 400);
      }

      if (parsedTotal < reservedQty + borrowedQty) {
        return sendError(
          res,
          `Cannot reduce totalQuantity below current reserved (${reservedQty}) and borrowed (${borrowedQty}) units`,
          'QUANTITY_CONFLICT',
          409
        );
      }

      updates.totalQuantity = parsedTotal;
      updates.availableQuantity = parsedTotal - reservedQty - borrowedQty;
    }

    const merged = { ...current, ...updates };
    updates.status = computeResourceStatus(merged);

    await actualRef.update(updates);

    return sendSuccess(res, 'Resource updated successfully', {
      resourceId,
      ...merged,
      ...updates
    });
  } catch (err) {
    console.error('updateResource error:', err);
    return sendError(res, 'Failed to update resource', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/resources/:resourceId/archive
 * Soft-delete / archive resource (Club owner only, no active borrowings permitted)
 */
export const archiveResource = async (req, res) => {
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

    const current = docSnap.data();

    // Owner check
    if (current.clubId !== req.user.clubId) {
      return sendError(res, 'Forbidden: You do not own this resource', 'FORBIDDEN', 403);
    }

    // Check inventory holds
    if ((Number(current.reservedQuantity) || 0) > 0 || (Number(current.borrowedQuantity) || 0) > 0) {
      return sendError(
        res,
        'Cannot archive resource with reserved or borrowed units',
        'RESOURCE_HAS_ACTIVE_BORROWINGS',
        409
      );
    }

    // Check active requests in BorrowingRequests collection
    const activeStatuses = ['Pending', 'Approved', 'Borrowed', 'Return Pending'];
    const requestsQuery = await db.collection('BorrowingRequests')
      .where('resourceId', '==', resourceId)
      .get();

    let hasActive = false;
    requestsQuery.forEach((doc) => {
      const data = doc.data();
      if (activeStatuses.includes(data.status)) {
        hasActive = true;
      }
    });

    if (hasActive) {
      return sendError(
        res,
        'Cannot archive resource with active or pending borrowing requests',
        'RESOURCE_HAS_ACTIVE_BORROWINGS',
        409
      );
    }

    await actualRef.update({
      isArchived: true,
      updatedAt: new Date().toISOString()
    });

    return sendSuccess(res, 'Resource archived successfully', {
      resourceId,
      isArchived: true
    });
  } catch (err) {
    console.error('archiveResource error:', err);
    return sendError(res, 'Failed to archive resource', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/resources/:resourceId/availability
 * Mark resource temporarily unavailable or available (Club owner only)
 */
export const updateAvailability = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { isTemporarilyUnavailable, remarks } = req.body;

    if (typeof isTemporarilyUnavailable !== 'boolean') {
      return sendError(res, 'isTemporarilyUnavailable must be a boolean', 'INVALID_INPUT', 400);
    }

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

    const current = docSnap.data();

    // Owner check
    if (current.clubId !== req.user.clubId) {
      return sendError(res, 'Forbidden: You do not own this resource', 'FORBIDDEN', 403);
    }

    // Cannot make an archived resource available
    if (current.isArchived === true && isTemporarilyUnavailable === false) {
      return sendError(res, 'Archived resource cannot be made available', 'RESOURCE_ARCHIVED', 409);
    }

    const updates = {
      isTemporarilyUnavailable,
      updatedAt: new Date().toISOString()
    };

    if (remarks !== undefined) {
      updates.remarks = remarks;
    }

    const merged = { ...current, ...updates };
    updates.status = computeResourceStatus(merged);

    await actualRef.update(updates);

    return sendSuccess(res, 'Resource availability updated successfully', {
      resourceId,
      isTemporarilyUnavailable,
      status: updates.status,
      remarks: updates.remarks !== undefined ? updates.remarks : current.remarks
    });
  } catch (err) {
    console.error('updateAvailability error:', err);
    return sendError(res, 'Failed to update resource availability', 'INTERNAL_ERROR', 500);
  }
};
