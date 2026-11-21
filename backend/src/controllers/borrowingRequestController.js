import { db } from '../config/firebase.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { calculateResourceStatus } from '../utils/resourceStatus.js';

export const submitBorrowingRequest = async (req, res) => {
  try {
    const {
      resourceId,
      eventId,
      quantity,
      purpose,
      pickupDate,
      expectedReturnDate,
      remarks,
      wouldHavePurchased
    } = req.body;

    // 1. Validate required inputs
    if (
      !resourceId ||
      !eventId ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      typeof purpose !== 'string' ||
      !purpose.trim() ||
      !pickupDate ||
      !expectedReturnDate ||
      typeof wouldHavePurchased !== 'boolean'
    ) {
      return sendError(
        res,
        'Invalid or missing required fields',
        'INVALID_INPUT',
        400
      );
    }

    if (remarks !== undefined && typeof remarks !== 'string') {
      return sendError(
        res,
        'Remarks must be a string',
        'INVALID_INPUT',
        400
      );
    }

    // 2. Validate dates
    const pickupTimestamp = Date.parse(pickupDate);
    const returnTimestamp = Date.parse(expectedReturnDate);

    if (
      Number.isNaN(pickupTimestamp) ||
      Number.isNaN(returnTimestamp) ||
      returnTimestamp <= pickupTimestamp
    ) {
      return sendError(
        res,
        'Expected return date must be later than pickup date',
        'INVALID_INPUT',
        400
      );
    }

    // 3. Get authenticated requester
    const requesterClubId = req.user.clubId;

    if (!requesterClubId) {
      return sendError(
        res,
        'Authenticated club information is missing',
        'FORBIDDEN',
        403
      );
    }

    // 4. Find Resource
    let resourceSnap = await db.collection('Resources').doc(resourceId).get();

    // Fallback: find by resourceId field if document ID is different
    if (!resourceSnap.exists) {
      const resourceQuery = await db.collection('Resources')
        .where('resourceId', '==', resourceId)
        .limit(1)
        .get();

      if (!resourceQuery.empty) {
        resourceSnap = resourceQuery.docs[0];
      }
    }

    if (!resourceSnap.exists) {
      return sendError(
        res,
        'Resource not found',
        'RESOURCE_NOT_FOUND',
        404
      );
    }

    const resourceData = resourceSnap.data();

    // 5. Check Resource availability
    if (
      resourceData.isArchived === true ||
      resourceData.isTemporarilyUnavailable === true
    ) {
      return sendError(
        res,
        'Resource is currently unavailable',
        'RESOURCE_NOT_AVAILABLE',
        409
      );
    }

    // 6. Prevent a club from borrowing its own resource
    const ownerClubId = resourceData.clubId;

    if (!ownerClubId) {
      return sendError(
        res,
        'Resource owner information is missing',
        'RESOURCE_NOT_AVAILABLE',
        409
      );
    }

    if (requesterClubId === ownerClubId) {
      return sendError(
        res,
        'A club cannot borrow its own resource',
        'FORBIDDEN',
        403
      );
    }

    // 7. Check available quantity
    const availableQuantity = resourceData.availableQuantity;

    if (
      !Number.isInteger(availableQuantity) ||
      availableQuantity <= 0
    ) {
      return sendError(
        res,
        'Resource has no available quantity',
        'RESOURCE_NOT_AVAILABLE',
        409
      );
    }

    if (quantity > availableQuantity) {
      return sendError(
        res,
        'Requested quantity exceeds available quantity',
        'INSUFFICIENT_QUANTITY',
        409
      );
    }

    // 8. Find Event
    let eventSnap = await db.collection('Events').doc(eventId).get();

    // Fallback: find by eventId field
    if (!eventSnap.exists) {
      const eventQuery = await db.collection('Events')
        .where('eventId', '==', eventId)
        .limit(1)
        .get();

      if (!eventQuery.empty) {
        eventSnap = eventQuery.docs[0];
      }
    }

    if (!eventSnap.exists) {
      return sendError(
        res,
        'Event not found',
        'EVENT_NOT_FOUND',
        404
      );
    }

    const eventData = eventSnap.data();

    // 9. Ensure Event belongs to the requesting club
    if (eventData.clubId !== requesterClubId) {
      return sendError(
        res,
        'You can only submit requests for your own club events',
        'FORBIDDEN',
        403
      );
    }

    // 10. Create Borrowing Request
    const requestRef = db.collection('BorrowingRequests').doc();
    const timestamp = new Date().toISOString();

    const requestData = {
      requestId: requestRef.id,
      resourceId,
      requesterClubId,
      ownerClubId,
      eventId,
      quantity,
      purpose: purpose.trim(),
      pickupDate,
      expectedReturnDate,
      remarks: remarks?.trim() || '',
      wouldHavePurchased,
      status: 'Pending',
      createdAt: timestamp,
      updatedAt: timestamp,

      ...(resourceData.estimatedUnitCost !== undefined &&
        resourceData.estimatedUnitCost !== null && {
          estimatedUnitCostAtBorrowing: resourceData.estimatedUnitCost
        }),

      ...(resourceData.estimatedUnitWeight !== undefined &&
        resourceData.estimatedUnitWeight !== null && {
          estimatedUnitWeightAtBorrowing: resourceData.estimatedUnitWeight
        })
    };

    await requestRef.set(requestData);

    // 11. Return successful response
    return sendSuccess(
        res,
        'Borrowing request submitted successfully',
        {
            requestId: requestRef.id,
            status: 'Pending'
        },
        201
        );

  } catch (err) {
    console.error('Submit borrowing request error:', err);

    return sendError(
      res,
      'Failed to submit borrowing request',
      'INTERNAL_ERROR',
      500
    );
  }
};


export const approveBorrowingRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ownerClubId = req.user.clubId;

    if (!requestId) {
      return sendError(res, 'Request ID is required', 'INVALID_INPUT', 400);
    }

    const requestRef = db.collection('BorrowingRequests').doc(requestId);
    let result;

    await db.runTransaction(async (transaction) => {
      // 1. Get borrowing request
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists) {
        const error = new Error('Borrowing request not found');
        error.code = 'REQUEST_NOT_FOUND';
        throw error;
      }

      const requestData = requestSnap.data();

      // 2. Verify request ownership first
        if (requestData.ownerClubId !== ownerClubId) {
        const error = new Error('You do not own this request');
        error.code = 'FORBIDDEN';
        throw error;
        }

        // 3. Check request status
        if (requestData.status !== 'Pending') {
        const error = new Error('Only Pending requests can be approved');
        error.code = 'REQUEST_ALREADY_PROCESSED';
        throw error;
        }

      // 3. Get resource
      const resourceRef = db.collection('Resources').doc(requestData.resourceId);
      const resourceSnap = await transaction.get(resourceRef);

      if (!resourceSnap.exists) {
        const error = new Error('Resource not found');
        error.code = 'RESOURCE_NOT_FOUND';
        throw error;
      }

      const resourceData = resourceSnap.data();

      // 4. Verify resource ownership
      if (resourceData.clubId !== ownerClubId) {
        const error = new Error('You do not own this resource');
        error.code = 'FORBIDDEN';
        throw error;
      }

      // 5. Check resource availability
      if (
        resourceData.isArchived === true ||
        resourceData.isTemporarilyUnavailable === true
      ) {
        const error = new Error('Resource is currently unavailable');
        error.code = 'RESOURCE_NOT_AVAILABLE';
        throw error;
      }

      const quantity = requestData.quantity;
      const availableQuantity = Number(resourceData.availableQuantity) || 0;
      const reservedQuantity = Number(resourceData.reservedQuantity) || 0;

      if (!Number.isInteger(quantity) || quantity <= 0) {
        const error = new Error('Invalid requested quantity');
        error.code = 'INVALID_INPUT';
        throw error;
      }

      // 6. Prevent negative available quantity
      if (availableQuantity < quantity) {
        const error = new Error('Insufficient available quantity');
        error.code = 'INSUFFICIENT_QUANTITY';
        throw error;
      }

      // 7. Calculate new inventory
      const newAvailableQuantity = availableQuantity - quantity;
      const newReservedQuantity = reservedQuantity + quantity;

      const newStatus = calculateResourceStatus({
        ...resourceData,
        availableQuantity: newAvailableQuantity,
        reservedQuantity: newReservedQuantity
        });

      const timestamp = new Date().toISOString();

      // 8. Update resource inventory
      transaction.update(resourceRef, {
        availableQuantity: newAvailableQuantity,
        reservedQuantity: newReservedQuantity,
        status: newStatus,
        updatedAt: timestamp
      });

      // 9. Update borrowing request
      transaction.update(requestRef, {
        status: 'Approved',
        updatedAt: timestamp
      });

      result = {
        requestId,
        status: 'Approved'
        };
    });

    return sendSuccess(
      res,
      'Borrowing request approved successfully',
      result
    );

  } catch (err) {
    console.error('Approve borrowing request error:', err);

    const errorResponses = {
      REQUEST_NOT_FOUND: ['Borrowing request not found', 404],
      RESOURCE_NOT_FOUND: ['Resource not found', 404],
      FORBIDDEN: ['You do not own this resource', 403],
      REQUEST_ALREADY_PROCESSED: ['Borrowing request has already been processed', 409],
      RESOURCE_NOT_AVAILABLE: ['Resource is currently unavailable', 409],
      INSUFFICIENT_QUANTITY: ['Insufficient available quantity', 409],
      INVALID_INPUT: ['Invalid requested quantity', 400]
    };

    const errorResponse = errorResponses[err.code];

    if (errorResponse) {
      return sendError(res, errorResponse[0], err.code, errorResponse[1]);
    }

    return sendError(
      res,
      'Failed to approve borrowing request',
      'INTERNAL_ERROR',
      500
    );
  }
};



export const rejectBorrowingRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { remarks } = req.body;
    const ownerClubId = req.user.clubId;

    if (!requestId) {
      return sendError(res, 'Request ID is required', 'INVALID_INPUT', 400);
    }

    if (remarks !== undefined && typeof remarks !== 'string') {
      return sendError(
        res,
        'Rejection remarks must be a string',
        'INVALID_INPUT',
        400
      );
    }

    const requestRef = db.collection('BorrowingRequests').doc(requestId);

    await db.runTransaction(async (transaction) => {
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists) {
        const error = new Error('Borrowing request not found');
        error.code = 'REQUEST_NOT_FOUND';
        throw error;
      }

      const requestData = requestSnap.data();

      if (requestData.ownerClubId !== ownerClubId) {
        const error = new Error('You do not own this request');
        error.code = 'FORBIDDEN';
        throw error;
}

      if (requestData.status !== 'Pending') {
        const error = new Error('Only Pending requests can be rejected');
        error.code = 'REQUEST_ALREADY_PROCESSED';
        throw error;
      }

      const resourceRef = db.collection('Resources').doc(requestData.resourceId);
      const resourceSnap = await transaction.get(resourceRef);

      if (!resourceSnap.exists) {
        const error = new Error('Resource not found');
        error.code = 'RESOURCE_NOT_FOUND';
        throw error;
      }

      const resourceData = resourceSnap.data();

      if (resourceData.clubId !== ownerClubId) {
        const error = new Error('You do not own this resource');
        error.code = 'FORBIDDEN';
        throw error;
      }

      const timestamp = new Date().toISOString();

      transaction.update(requestRef, {
        status: 'Rejected',
        ...(remarks?.trim()
          ? { rejectionRemarks: remarks.trim() }
          : {}),
        updatedAt: timestamp
      });
    });

    return sendSuccess(
      res,
      'Borrowing request rejected successfully',
      {
        requestId,
        status: 'Rejected',
        ...(remarks?.trim()
          ? { remarks: remarks.trim() }
          : {})
      }
    );

  } catch (err) {
    console.error('Reject borrowing request error:', err);

    const errorResponses = {
      REQUEST_NOT_FOUND: ['Borrowing request not found', 404],
      RESOURCE_NOT_FOUND: ['Resource not found', 404],
      FORBIDDEN: ['You do not own this resource', 403],
      REQUEST_ALREADY_PROCESSED: [
        'Borrowing request has already been processed',
        409
      ]
    };

    const errorResponse = errorResponses[err.code];

    if (errorResponse) {
      return sendError(res, errorResponse[0], err.code, errorResponse[1]);
    }

    return sendError(
      res,
      'Failed to reject borrowing request',
      'INTERNAL_ERROR',
      500
    );
  }
};


const addOverdueFlags = (requestData) => {
  const now = Date.now();

  const pickupTime = Date.parse(requestData.pickupDate);
  const returnTime = Date.parse(requestData.expectedReturnDate);

  return {
    ...requestData,

    isPickupOverdue:
      requestData.status === 'Approved' &&
      !Number.isNaN(pickupTime) &&
      pickupTime < now,

    isOverdue:
      requestData.status === 'Borrowed' &&
      !Number.isNaN(returnTime) &&
      returnTime < now
  };
};


// GET /api/borrowing-requests
export const getBorrowingRequests = async (req, res) => {
  try {
    const { status, resourceId } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    const collection = db.collection('BorrowingRequests');

    let snapshots = [];

    if (req.user.role === 'admin') {
      let query = collection;

      if (status) {
        query = query.where('status', '==', status);
      }

      if (resourceId) {
        query = query.where('resourceId', '==', resourceId);
      }

      const snapshot = await query.get();
      snapshots = snapshot.docs;

    } else if (req.user.role === 'club') {
      const clubId = req.user.clubId;

      if (!clubId) {
        return sendError(
          res,
          'Club information is missing',
          'FORBIDDEN',
          403
        );
      }

      // A Club can only see requests where it is
      // either the requester or the resource owner.
      let requesterQuery = collection.where(
        'requesterClubId',
        '==',
        clubId
      );

      let ownerQuery = collection.where(
        'ownerClubId',
        '==',
        clubId
      );

      if (status) {
        requesterQuery = requesterQuery.where('status', '==', status);
        ownerQuery = ownerQuery.where('status', '==', status);
      }

      if (resourceId) {
        requesterQuery = requesterQuery.where(
          'resourceId',
          '==',
          resourceId
        );

        ownerQuery = ownerQuery.where(
          'resourceId',
          '==',
          resourceId
        );
      }

      const [requesterSnapshot, ownerSnapshot] = await Promise.all([
        requesterQuery.get(),
        ownerQuery.get()
      ]);

      // Merge results and remove duplicate documents.
      const requestMap = new Map();

      [...requesterSnapshot.docs, ...ownerSnapshot.docs].forEach((doc) => {
        requestMap.set(doc.id, doc);
      });

      snapshots = Array.from(requestMap.values());

    } else {
      return sendError(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const requests = snapshots.map((doc) => {
      return addOverdueFlags({
        ...doc.data(),
        requestId: doc.id
      });
    });

    // Sort newest requests first.
    requests.sort((a, b) => {
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });

    const total = requests.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;

    const paginatedRequests = requests.slice(
      startIndex,
      startIndex + limit
    );

    return sendSuccess(
      res,
      'Borrowing requests retrieved successfully',
      {
        requests: paginatedRequests,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    );

  } catch (err) {
    console.error('Get borrowing requests error:', err);

    return sendError(
      res,
      'Failed to retrieve borrowing requests',
      'INTERNAL_ERROR',
      500
    );
  }
};


// GET /api/borrowing-requests/:requestId
export const getBorrowingRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;

    if (!requestId) {
      return sendError(
        res,
        'Request ID is required',
        'INVALID_INPUT',
        400
      );
    }

    const requestSnap = await db
      .collection('BorrowingRequests')
      .doc(requestId)
      .get();

    if (!requestSnap.exists) {
      return sendError(
        res,
        'Borrowing request not found',
        'REQUEST_NOT_FOUND',
        404
      );
    }

    const requestData = requestSnap.data();

    // Server-side access control.
    if (req.user.role === 'club') {
      const clubId = req.user.clubId;

      const isRequester = requestData.requesterClubId === clubId;
      const isOwner = requestData.ownerClubId === clubId;

      if (!isRequester && !isOwner) {
        return sendError(
          res,
          'You are not allowed to view this borrowing request',
          'FORBIDDEN',
          403
        );
      }

    } else if (req.user.role !== 'admin') {
      return sendError(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const request = addOverdueFlags({
      ...requestData,
      requestId: requestSnap.id
    });

    return sendSuccess(
      res,
      'Borrowing request retrieved successfully',
      request
    );

  } catch (err) {
    console.error('Get borrowing request error:', err);

    return sendError(
      res,
      'Failed to retrieve borrowing request',
      'INTERNAL_ERROR',
      500
    );
  }
};


export const submitResourceReturn = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { actualReturnDate, remarks } = req.body;
    const requesterClubId = req.user.clubId;

    if (!requestId || !actualReturnDate) {
      return sendError(
        res,
        'Request ID and actual return date are required',
        'INVALID_INPUT',
        400
      );
    }

    if (Number.isNaN(Date.parse(actualReturnDate))) {
      return sendError(
        res,
        'Invalid actual return date',
        'INVALID_INPUT',
        400
      );
    }

    if (remarks !== undefined && typeof remarks !== 'string') {
      return sendError(
        res,
        'Remarks must be a string',
        'INVALID_INPUT',
        400
      );
    }

    const requestRef = db.collection('BorrowingRequests').doc(requestId);
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists) {
        const error = new Error('Borrowing request not found');
        error.code = 'REQUEST_NOT_FOUND';
        throw error;
      }

      const requestData = requestSnap.data();

      if (requestData.requesterClubId !== requesterClubId) {
        const error = new Error('You are not the requesting club');
        error.code = 'FORBIDDEN';
        throw error;
      }

      if (requestData.status !== 'Borrowed') {
        const error = new Error('Only Borrowed requests can be returned');
        error.code = 'INVALID_STATUS_TRANSITION';
        throw error;
      }

      transaction.update(requestRef, {
        actualReturnDate,
        status: 'Return Pending',
        ...(remarks !== undefined ? { returnRemarks: remarks.trim() } : {}),
        updatedAt: timestamp
      });
    });

    return sendSuccess(
      res,
      'Return submitted for verification',
      {
        requestId,
        status: 'Return Pending',
        actualReturnDate
      }
    );

  } catch (err) {
    console.error('Submit resource return error:', err);

    const errorResponses = {
      REQUEST_NOT_FOUND: ['Borrowing request not found', 404],
      FORBIDDEN: ['You are not the requesting club', 403],
      INVALID_STATUS_TRANSITION: [
        'Only Borrowed requests can be returned',
        409
      ]
    };

    const errorResponse = errorResponses[err.code];

    if (errorResponse) {
      return sendError(res, errorResponse[0], err.code, errorResponse[1]);
    }

    return sendError(
      res,
      'Failed to submit resource return',
      'INTERNAL_ERROR',
      500
    );
  }
};


export const completeBorrowingRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const {
      returnedQuantity,
      usableQuantity,
      damagedQuantity,
      missingQuantity,
      returnCondition,
      remarks
    } = req.body;

    const ownerClubId = req.user.clubId;

    if (!requestId) {
      return sendError(res, 'Request ID is required', 'INVALID_INPUT', 400);
    }

    const quantities = [
      returnedQuantity,
      usableQuantity,
      damagedQuantity,
      missingQuantity
    ];

    if (
      !quantities.every(
        value => Number.isSafeInteger(value) && value >= 0
      )
    ) {
      return sendError(
        res,
        'Return quantities must be non-negative integers',
        'INVALID_RETURN_QUANTITY',
        400
      );
    }

    if (
      typeof returnCondition !== 'string' ||
      !returnCondition.trim()
    ) {
      return sendError(
        res,
        'Return condition is required',
        'INVALID_INPUT',
        400
      );
    }

    if (remarks !== undefined && typeof remarks !== 'string') {
      return sendError(
        res,
        'Remarks must be a string',
        'INVALID_INPUT',
        400
      );
    }

    if (
      returnedQuantity !== usableQuantity + damagedQuantity
    ) {
      return sendError(
        res,
        'Returned quantity must equal usable plus damaged quantity',
        'INVALID_RETURN_QUANTITY',
        400
      );
    }

    const requestRef = db.collection('BorrowingRequests').doc(requestId);

    const timestamp = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      // 1. Read borrowing request
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists) {
        throw new Error('REQUEST_NOT_FOUND');
      }

      const requestData = requestSnap.data();

      if (requestData.ownerClubId !== ownerClubId) {
        throw new Error('FORBIDDEN');
      }

      if (requestData.status !== 'Return Pending') {
        throw new Error('INVALID_STATUS_TRANSITION');
      }

      const originalQuantity = requestData.quantity;

      if (
        !Number.isSafeInteger(originalQuantity) ||
        originalQuantity <= 0 ||
        originalQuantity !== usableQuantity + damagedQuantity + missingQuantity
      ) {
        throw new Error('INVALID_RETURN_QUANTITY');
      }

      // 2. Read resource
      const resourceRef = db
        .collection('Resources')
        .doc(requestData.resourceId);

      const resourceSnap = await transaction.get(resourceRef);

      if (!resourceSnap.exists) {
        throw new Error('RESOURCE_NOT_FOUND');
      }

      const resourceData = resourceSnap.data();

      if (resourceData.clubId !== ownerClubId) {
        throw new Error('FORBIDDEN');
      }

      const {
        totalQuantity,
        availableQuantity,
        reservedQuantity,
        borrowedQuantity
      } = resourceData;

      const inventoryQuantities = [
        totalQuantity,
        availableQuantity,
        reservedQuantity,
        borrowedQuantity
      ];

      if (
        !inventoryQuantities.every(
          value => Number.isSafeInteger(value) && value >= 0
        )
      ) {
        throw new Error('INVENTORY_CONFLICT');
      }

      // 3. Check current inventory consistency
      if (
        totalQuantity !==
        availableQuantity + reservedQuantity + borrowedQuantity
      ) {
        throw new Error('INVENTORY_CONFLICT');
      }

      if (
        borrowedQuantity < originalQuantity ||
        totalQuantity < damagedQuantity + missingQuantity
      ) {
        throw new Error('INVENTORY_CONFLICT');
      }

      // 4. Calculate updated inventory
      const newTotalQuantity =
        totalQuantity - damagedQuantity - missingQuantity;

      const newAvailableQuantity =
        availableQuantity + usableQuantity;

      const newBorrowedQuantity =
        borrowedQuantity - originalQuantity;

      // Current status rules do not define an all-zero inventory state.
      if (
        newTotalQuantity === 0 &&
        newAvailableQuantity === 0 &&
        reservedQuantity === 0 &&
        newBorrowedQuantity === 0
      ) {
        throw new Error('INVENTORY_CONFLICT');
      }

      const newStatus = calculateResourceStatus({
        ...resourceData,
        totalQuantity: newTotalQuantity,
        availableQuantity: newAvailableQuantity,
        reservedQuantity,
        borrowedQuantity: newBorrowedQuantity
      });

      // 5. Update resource inventory
      transaction.update(resourceRef, {
        totalQuantity: newTotalQuantity,
        availableQuantity: newAvailableQuantity,
        borrowedQuantity: newBorrowedQuantity,
        status: newStatus,
        updatedAt: timestamp
      });

      // 6. Complete borrowing request
      transaction.update(requestRef, {
        status: 'Completed',
        returnedQuantity,
        usableQuantity,
        damagedQuantity,
        missingQuantity,
        returnCondition: returnCondition.trim(),
        ...(remarks !== undefined
          ? { verificationRemarks: remarks.trim() }
          : {}),
        returnVerifiedAt: timestamp,
        updatedAt: timestamp
      });
    });

    return sendSuccess(
      res,
      'Borrowing request completed',
      {
        requestId,
        status: 'Completed',
        returnedQuantity,
        usableQuantity,
        damagedQuantity,
        missingQuantity,
        returnCondition: returnCondition.trim(),
        returnVerifiedAt: timestamp
      }
    );

  } catch (err) {
    const errorMap = {
      REQUEST_NOT_FOUND: ['Borrowing request not found', 404],
      RESOURCE_NOT_FOUND: ['Resource not found', 404],
      FORBIDDEN: ['You are not authorized to complete this request', 403],
      INVALID_STATUS_TRANSITION: ['Request is not awaiting return verification', 409],
      INVALID_RETURN_QUANTITY: ['Return quantities are invalid or inconsistent', 400],
      INVENTORY_CONFLICT: ['Inventory quantities are inconsistent', 409]
    };

    const mappedError = errorMap[err.message];

    if (mappedError) {
      return sendError(
        res,
        mappedError[0],
        err.message,
        mappedError[1]
      );
    }

    console.error('Complete borrowing request error:', err);

    return sendError(
      res,
      'Failed to complete borrowing request',
      'INTERNAL_ERROR',
      500
    );
  }
};


export const markResourceBorrowed = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ownerClubId = req.user.clubId;

    if (!requestId) {
      return sendError(res, 'Request ID is required', 'INVALID_INPUT', 400);
    }

    await db.runTransaction(async (transaction) => {
      const requestRef = db.collection('BorrowingRequests').doc(requestId);
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists) {
        throw new Error('REQUEST_NOT_FOUND');
      }

      const requestData = requestSnap.data();

      if (requestData.ownerClubId !== ownerClubId) {
        throw new Error('FORBIDDEN');
      }

      if (requestData.status !== 'Approved') {
        throw new Error('INVALID_STATUS_TRANSITION');
      }

      const resourceRef = db.collection('Resources').doc(requestData.resourceId);
      const resourceSnap = await transaction.get(resourceRef);

      if (!resourceSnap.exists) {
        throw new Error('RESOURCE_NOT_FOUND');
      }

      const resourceData = resourceSnap.data();

      if (resourceData.clubId !== ownerClubId) {
        throw new Error('FORBIDDEN');
      }

      const quantity = requestData.quantity;
      const totalQuantity = resourceData.totalQuantity;
      const availableQuantity = resourceData.availableQuantity;
      const reservedQuantity = resourceData.reservedQuantity;
      const borrowedQuantity = resourceData.borrowedQuantity;

      const inventoryValues = [
        quantity,
        totalQuantity,
        availableQuantity,
        reservedQuantity,
        borrowedQuantity
      ];

      if (
        !inventoryValues.every(
          value => Number.isSafeInteger(value) && value >= 0
        ) ||
        quantity <= 0 ||
        totalQuantity !== availableQuantity + reservedQuantity + borrowedQuantity ||
        reservedQuantity < quantity
      ) {
        throw new Error('INVALID_STATUS_TRANSITION');
      }

      const newReservedQuantity = reservedQuantity - quantity;
      const newBorrowedQuantity = borrowedQuantity + quantity;

      const newStatus = calculateResourceStatus({
        ...resourceData,
        availableQuantity,
        reservedQuantity: newReservedQuantity,
        borrowedQuantity: newBorrowedQuantity
      });

      transaction.update(resourceRef, {
        reservedQuantity: newReservedQuantity,
        borrowedQuantity: newBorrowedQuantity,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      transaction.update(requestRef, {
        status: 'Borrowed',
        updatedAt: new Date().toISOString()
      });
    });

    return sendSuccess(
      res,
      'Borrowing status updated',
      { requestId, status: 'Borrowed' }
    );

  } catch (err) {
    const errorMap = {
      REQUEST_NOT_FOUND: ['Request not found', 'REQUEST_NOT_FOUND', 404],
      RESOURCE_NOT_FOUND: ['Resource not found', 'RESOURCE_NOT_FOUND', 404],
      FORBIDDEN: ['You are not authorised to perform this action', 'FORBIDDEN', 403],
      INVALID_STATUS_TRANSITION: [
        'Request cannot be marked as borrowed',
        'INVALID_STATUS_TRANSITION',
        409
      ]
    };

    const mappedError = errorMap[err.message];

    if (mappedError) {
      return sendError(res, ...mappedError);
    }

    console.error('Mark resource borrowed error:', err);
    return sendError(res, 'Failed to update borrowing status');
  }
};
