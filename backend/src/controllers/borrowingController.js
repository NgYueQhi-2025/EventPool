import { db } from '../config/firebase.js';
import { sendSuccess, sendError, formatTimestamp } from '../utils/response.js';
import { calculateResourceStatus } from '../utils/resourceStatus.js';

const computeResourceStatus = (resource) => {
  try {
    return calculateResourceStatus(resource);
  } catch {
    return 'Unavailable';
  }
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const computeIsOverdue = (req) => {
  if (!['Approved', 'Borrowed', 'Return Pending'].includes(req.status)) {
    return false;
  }
  return Boolean(req.expectedReturnDate && req.expectedReturnDate < todayISO());
};

const formatRequestDoc = (doc) => {
  const data = doc.data();
  const requestId = data.requestId || doc.id;
  const formatted = {
    ...data,
    requestId,
    borrowingRequestId: requestId,
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
  formatted.isOverdue = computeIsOverdue(formatted);
  return formatted;
};

/**
 * POST /api/borrowing-requests
 * Create a new borrowing request (Club only)
 */
export const createBorrowingRequest = async (req, res) => {
  try {
    const {
      resourceId,
      eventId,
      eventName: bodyEventName,
      quantity,
      purpose,
      pickupDate,
      expectedReturnDate,
      wouldHavePurchased,
      remarks,
    } = req.body;

    const parsedQty = Number(quantity);
    if (
      !resourceId ||
      !purpose ||
      !String(purpose).trim() ||
      !pickupDate ||
      !expectedReturnDate ||
      !Number.isInteger(parsedQty) ||
      parsedQty <= 0
    ) {
      return sendError(
        res,
        'Missing or invalid fields: resourceId, positive integer quantity, purpose, pickupDate, expectedReturnDate are required',
        'INVALID_INPUT',
        400
      );
    }

    if (pickupDate < todayISO()) {
      return sendError(
        res,
        'Pickup date cannot be in the past',
        'INVALID_DATE_RANGE',
        400
      );
    }

    if (expectedReturnDate <= pickupDate) {
      return sendError(
        res,
        'Expected return date must be after pickup date',
        'INVALID_DATE_RANGE',
        400
      );
    }

    // Fetch resource
    const resRef = db.collection('Resources').doc(resourceId);
    const resSnap = await resRef.get();
    if (!resSnap.exists) {
      return sendError(res, 'Resource not found', 'RESOURCE_NOT_FOUND', 404);
    }
    const resource = resSnap.data();

    // Prevent borrowing own club's resource
    if (resource.clubId === req.user.clubId) {
      return sendError(
        res,
        'Forbidden: You cannot borrow a resource owned by your own club',
        'FORBIDDEN',
        403
      );
    }

    // Check resource availability & owner club status
    if (resource.isArchived === true || resource.isTemporarilyUnavailable === true) {
      return sendError(
        res,
        'Resource is currently unavailable for borrowing',
        'RESOURCE_NOT_AVAILABLE',
        409
      );
    }

    const ownerClubSnap = await db.collection('Clubs').doc(resource.clubId).get();
    if (ownerClubSnap.exists && ownerClubSnap.data().isActive === false) {
      return sendError(
        res,
        'Owner club is currently inactive',
        'RESOURCE_NOT_AVAILABLE',
        409
      );
    }

    if (Number(resource.availableQuantity) < parsedQty) {
      return sendError(
        res,
        `Insufficient quantity available (${resource.availableQuantity} remaining)`,
        'INSUFFICIENT_QUANTITY',
        409
      );
    }

    // Resolve event name if eventId provided
    let resolvedEventName = bodyEventName ? String(bodyEventName).trim() : '';
    if (eventId) {
      const evtSnap = await db.collection('Events').doc(eventId).get();
      if (evtSnap.exists) {
        const evt = evtSnap.data();
        if (evt.clubId !== req.user.clubId) {
          return sendError(res, 'Forbidden: Event does not belong to your club', 'FORBIDDEN', 403);
        }
        resolvedEventName = evt.eventName || resolvedEventName;
      }
    }

    const reqRef = db.collection('BorrowingRequests').doc();
    const requestId = reqRef.id;
    const now = new Date().toISOString();

    const newRequest = {
      requestId,
      borrowingRequestId: requestId,
      resourceId,
      ownerClubId: resource.clubId,
      borrowerClubId: req.user.clubId,
      eventId: eventId || null,
      eventName: resolvedEventName || 'Club Event',
      quantity: parsedQty,
      purpose: String(purpose).trim(),
      wouldHavePurchased: Boolean(wouldHavePurchased),
      remarks: remarks ? String(remarks).trim() : '',
      pickupDate,
      expectedReturnDate,
      status: 'Pending',
      returnCondition: null,
      actualReturnDate: null,
      createdAt: now,
      updatedAt: now,
    };

    await reqRef.set(newRequest);

    return sendSuccess(
      res,
      'Borrowing request submitted successfully',
      { ...newRequest, isOverdue: false },
      201
    );
  } catch (err) {
    console.error('createBorrowingRequest error:', err);
    return sendError(res, 'Failed to create borrowing request', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/borrowing-requests
 * List borrowing requests (clubs see own incoming & outgoing; admins see all)
 */
export const getBorrowingRequests = async (req, res) => {
  try {
    const { status, direction, clubId, resourceId } = req.query;
    const snapshot = await db.collection('BorrowingRequests').get();

    let items = [];
    snapshot.forEach((doc) => {
      items.push(formatRequestDoc(doc));
    });

    if (req.user.role === 'club') {
      const myClubId = req.user.clubId;
      if (direction === 'incoming') {
        items = items.filter((r) => r.ownerClubId === myClubId);
      } else if (direction === 'outgoing') {
        items = items.filter((r) => r.borrowerClubId === myClubId);
      } else {
        items = items.filter(
          (r) => r.ownerClubId === myClubId || r.borrowerClubId === myClubId
        );
      }
    } else if (req.user.role === 'admin' && clubId) {
      items = items.filter(
        (r) => r.ownerClubId === clubId || r.borrowerClubId === clubId
      );
    }

    if (status) {
      items = items.filter((r) => r.status === status);
    }
    if (resourceId) {
      items = items.filter((r) => r.resourceId === resourceId);
    }

    // Sort newest first
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return sendSuccess(res, 'Borrowing requests retrieved successfully', items);
  } catch (err) {
    console.error('getBorrowingRequests error:', err);
    return sendError(res, 'Failed to fetch borrowing requests', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/borrowing-requests/:requestId
 */
export const getBorrowingRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const docSnap = await db.collection('BorrowingRequests').doc(requestId).get();
    if (!docSnap.exists) {
      return sendError(res, 'Borrowing request not found', 'REQUEST_NOT_FOUND', 404);
    }

    const formatted = formatRequestDoc(docSnap);
    if (
      req.user.role === 'club' &&
      formatted.ownerClubId !== req.user.clubId &&
      formatted.borrowerClubId !== req.user.clubId
    ) {
      return sendError(res, 'Forbidden: You cannot view this borrowing request', 'FORBIDDEN', 403);
    }

    return sendSuccess(res, 'Borrowing request retrieved successfully', formatted);
  } catch (err) {
    console.error('getBorrowingRequestById error:', err);
    return sendError(res, 'Failed to retrieve borrowing request', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/borrowing-requests/:requestId/approve
 * Owner approves pending request; atomically moves stock from available -> reserved
 */
export const approveBorrowingRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const reqRef = db.collection('BorrowingRequests').doc(requestId);

    const updated = await db.runTransaction(async (t) => {
      const reqSnap = await t.get(reqRef);
      if (!reqSnap.exists) {
        const err = new Error('Borrowing request not found');
        err.status = 404;
        err.code = 'REQUEST_NOT_FOUND';
        throw err;
      }

      const reqData = reqSnap.data();
      if (reqData.ownerClubId !== req.user.clubId) {
        const err = new Error('Forbidden: Only the resource owner can approve this request');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }

      if (reqData.status !== 'Pending') {
        const err = new Error(`Cannot approve a request in status '${reqData.status}'`);
        err.status = 409;
        err.code = 'INVALID_STATUS_TRANSITION';
        throw err;
      }

      const borrowerClubRef = db.collection('Clubs').doc(reqData.borrowerClubId);
      const borrowerClubSnap = await t.get(borrowerClubRef);
      if (borrowerClubSnap.exists && borrowerClubSnap.data().isActive === false) {
        const err = new Error('Cannot approve: borrowing club account is disabled');
        err.status = 409;
        err.code = 'ACCOUNT_DISABLED';
        throw err;
      }

      const resRef = db.collection('Resources').doc(reqData.resourceId);
      const resSnap = await t.get(resRef);
      if (!resSnap.exists) {
        const err = new Error('Resource not found');
        err.status = 404;
        err.code = 'RESOURCE_NOT_FOUND';
        throw err;
      }

      const resData = resSnap.data();
      if (resData.isArchived === true || resData.isTemporarilyUnavailable === true) {
        const err = new Error('Resource is no longer available');
        err.status = 409;
        err.code = 'RESOURCE_NOT_AVAILABLE';
        throw err;
      }

      const qty = Number(reqData.quantity);
      const currentAvail = Number(resData.availableQuantity) || 0;
      const currentReserved = Number(resData.reservedQuantity) || 0;

      if (currentAvail < qty) {
        const err = new Error(`Insufficient stock: only ${currentAvail} available`);
        err.status = 409;
        err.code = 'INSUFFICIENT_QUANTITY';
        throw err;
      }

      const now = new Date().toISOString();
      const nextAvail = currentAvail - qty;
      const nextReserved = currentReserved + qty;
      const nextResStatus = computeResourceStatus({
        ...resData,
        availableQuantity: nextAvail,
        reservedQuantity: nextReserved,
      });

      t.update(resRef, {
        availableQuantity: nextAvail,
        reservedQuantity: nextReserved,
        status: nextResStatus,
        updatedAt: now,
      });

      t.update(reqRef, {
        status: 'Approved',
        updatedAt: now,
      });

      return { ...reqData, requestId, status: 'Approved', updatedAt: now };
    });

    return sendSuccess(res, 'Borrowing request approved and stock reserved', updated);
  } catch (err) {
    if (err.status) {
      return sendError(res, err.message, err.code, err.status);
    }
    console.error('approveBorrowingRequest error:', err);
    return sendError(res, 'Failed to approve borrowing request', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/borrowing-requests/:requestId/reject
 * Owner rejects pending request; inventory untouched
 */
export const rejectBorrowingRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body || {};
    const reqRef = db.collection('BorrowingRequests').doc(requestId);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
      return sendError(res, 'Borrowing request not found', 'REQUEST_NOT_FOUND', 404);
    }

    const reqData = reqSnap.data();
    if (reqData.ownerClubId !== req.user.clubId) {
      return sendError(res, 'Forbidden: Only the resource owner can reject this request', 'FORBIDDEN', 403);
    }

    if (reqData.status !== 'Pending') {
      return sendError(
        res,
        `Cannot reject a request in status '${reqData.status}'`,
        'INVALID_STATUS_TRANSITION',
        409
      );
    }

    const now = new Date().toISOString();
    const updates = {
      status: 'Rejected',
      rejectionReason: reason ? String(reason).trim() : '',
      updatedAt: now,
    };

    await reqRef.update(updates);

    return sendSuccess(res, 'Borrowing request rejected', {
      ...reqData,
      requestId,
      ...updates,
    });
  } catch (err) {
    console.error('rejectBorrowingRequest error:', err);
    return sendError(res, 'Failed to reject borrowing request', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/borrowing-requests/:requestId/borrow
 * Owner marks approved request as collected/borrowed; moves reserved -> borrowed
 */
export const markBorrowed = async (req, res) => {
  try {
    const { requestId } = req.params;
    const reqRef = db.collection('BorrowingRequests').doc(requestId);

    const updated = await db.runTransaction(async (t) => {
      const reqSnap = await t.get(reqRef);
      if (!reqSnap.exists) {
        const err = new Error('Borrowing request not found');
        err.status = 404;
        err.code = 'REQUEST_NOT_FOUND';
        throw err;
      }

      const reqData = reqSnap.data();
      if (reqData.ownerClubId !== req.user.clubId) {
        const err = new Error('Forbidden: Only the resource owner can confirm pickup');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }

      if (reqData.status !== 'Approved') {
        const err = new Error(`Cannot mark collected from status '${reqData.status}'`);
        err.status = 409;
        err.code = 'INVALID_STATUS_TRANSITION';
        throw err;
      }

      const resRef = db.collection('Resources').doc(reqData.resourceId);
      const resSnap = await t.get(resRef);
      if (!resSnap.exists) {
        const err = new Error('Resource not found');
        err.status = 404;
        err.code = 'RESOURCE_NOT_FOUND';
        throw err;
      }

      const resData = resSnap.data();
      const qty = Number(reqData.quantity);
      const nextReserved = Math.max(0, (Number(resData.reservedQuantity) || 0) - qty);
      const nextBorrowed = (Number(resData.borrowedQuantity) || 0) + qty;
      const now = new Date().toISOString();

      const nextResStatus = computeResourceStatus({
        ...resData,
        reservedQuantity: nextReserved,
        borrowedQuantity: nextBorrowed,
      });

      t.update(resRef, {
        reservedQuantity: nextReserved,
        borrowedQuantity: nextBorrowed,
        status: nextResStatus,
        updatedAt: now,
      });

      t.update(reqRef, {
        status: 'Borrowed',
        updatedAt: now,
      });

      return { ...reqData, requestId, status: 'Borrowed', updatedAt: now };
    });

    return sendSuccess(res, 'Resource marked as Borrowed', updated);
  } catch (err) {
    if (err.status) {
      return sendError(res, err.message, err.code, err.status);
    }
    console.error('markBorrowed error:', err);
    return sendError(res, 'Failed to mark request as borrowed', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/borrowing-requests/:requestId/cancel
 * Borrower cancels Pending or Approved request; releases reserved stock if Approved
 */
export const cancelBorrowingRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const reqRef = db.collection('BorrowingRequests').doc(requestId);

    const updated = await db.runTransaction(async (t) => {
      const reqSnap = await t.get(reqRef);
      if (!reqSnap.exists) {
        const err = new Error('Borrowing request not found');
        err.status = 404;
        err.code = 'REQUEST_NOT_FOUND';
        throw err;
      }

      const reqData = reqSnap.data();
      if (reqData.borrowerClubId !== req.user.clubId) {
        const err = new Error('Forbidden: Only the requesting club can cancel this request');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }

      if (!['Pending', 'Approved'].includes(reqData.status)) {
        const err = new Error(`Cannot cancel a request in status '${reqData.status}'`);
        err.status = 409;
        err.code = 'INVALID_STATUS_TRANSITION';
        throw err;
      }

      const now = new Date().toISOString();

      if (reqData.status === 'Approved') {
        const resRef = db.collection('Resources').doc(reqData.resourceId);
        const resSnap = await t.get(resRef);
        if (resSnap.exists) {
          const resData = resSnap.data();
          const qty = Number(reqData.quantity);
          const nextReserved = Math.max(0, (Number(resData.reservedQuantity) || 0) - qty);
          const nextAvail = (Number(resData.availableQuantity) || 0) + qty;
          const nextResStatus = computeResourceStatus({
            ...resData,
            reservedQuantity: nextReserved,
            availableQuantity: nextAvail,
          });

          t.update(resRef, {
            reservedQuantity: nextReserved,
            availableQuantity: nextAvail,
            status: nextResStatus,
            updatedAt: now,
          });
        }
      }

      t.update(reqRef, {
        status: 'Cancelled',
        updatedAt: now,
      });

      return { ...reqData, requestId, status: 'Cancelled', updatedAt: now };
    });

    return sendSuccess(res, 'Borrowing request cancelled', updated);
  } catch (err) {
    if (err.status) {
      return sendError(res, err.message, err.code, err.status);
    }
    console.error('cancelBorrowingRequest error:', err);
    return sendError(res, 'Failed to cancel borrowing request', 'INTERNAL_ERROR', 500);
  }
};

/**
 * PATCH /api/borrowing-requests/:requestId/initiate-return
 * Borrower initiates return (Borrowed -> Return Pending)
 */
export const initiateReturn = async (req, res) => {
  try {
    const { requestId } = req.params;
    const reqRef = db.collection('BorrowingRequests').doc(requestId);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
      return sendError(res, 'Borrowing request not found', 'REQUEST_NOT_FOUND', 404);
    }

    const reqData = reqSnap.data();
    if (reqData.borrowerClubId !== req.user.clubId) {
      return sendError(res, 'Forbidden: Only the borrowing club can initiate return', 'FORBIDDEN', 403);
    }

    if (reqData.status !== 'Borrowed') {
      return sendError(
        res,
        `Cannot initiate return from status '${reqData.status}'`,
        'INVALID_STATUS_TRANSITION',
        409
      );
    }

    const now = new Date().toISOString();
    const updates = {
      status: 'Return Pending',
      returnedDate: todayISO(),
      updatedAt: now,
    };

    await reqRef.update(updates);
    return sendSuccess(res, 'Return initiated, awaiting owner verification', {
      ...reqData,
      requestId,
      ...updates,
    });
  } catch (err) {
    console.error('initiateReturn error:', err);
    return sendError(res, 'Failed to initiate return', 'INTERNAL_ERROR', 500);
  }
};

/**
 * POST /api/borrowing-requests/:requestId/return (also mounted as PATCH)
 * Owner inspects & completes return (Borrowed / Return Pending -> Completed)
 */
export const verifyReturn = async (req, res) => {
  try {
    const { requestId } = req.params;
    const {
      reusable,
      usable,
      damaged = 0,
      missing = 0,
      returnCondition,
    } = req.body || {};

    const reusableQty = Number(reusable !== undefined ? reusable : usable);
    const damagedQty = Number(damaged);
    const missingQty = Number(missing);

    if (
      isNaN(reusableQty) ||
      isNaN(damagedQty) ||
      isNaN(missingQty) ||
      reusableQty < 0 ||
      damagedQty < 0 ||
      missingQty < 0
    ) {
      return sendError(res, 'Invalid return quantities', 'INVALID_INPUT', 400);
    }

    const reqRef = db.collection('BorrowingRequests').doc(requestId);

    const updated = await db.runTransaction(async (t) => {
      const reqSnap = await t.get(reqRef);
      if (!reqSnap.exists) {
        const err = new Error('Borrowing request not found');
        err.status = 404;
        err.code = 'REQUEST_NOT_FOUND';
        throw err;
      }

      const reqData = reqSnap.data();
      if (reqData.ownerClubId !== req.user.clubId) {
        const err = new Error('Forbidden: Only the resource owner can verify return');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }

      if (!['Borrowed', 'Return Pending'].includes(reqData.status)) {
        const err = new Error(`Cannot verify return from status '${reqData.status}'`);
        err.status = 409;
        err.code = 'INVALID_STATUS_TRANSITION';
        throw err;
      }

      const qty = Number(reqData.quantity);
      if (reusableQty + damagedQty + missingQty !== qty) {
        const err = new Error(
          `Sum of reusable (${reusableQty}) + damaged (${damagedQty}) + missing (${missingQty}) must equal borrowed quantity (${qty})`
        );
        err.status = 400;
        err.code = 'INVALID_INPUT';
        throw err;
      }

      const resRef = db.collection('Resources').doc(reqData.resourceId);
      const resSnap = await t.get(resRef);
      if (!resSnap.exists) {
        const err = new Error('Resource not found');
        err.status = 404;
        err.code = 'RESOURCE_NOT_FOUND';
        throw err;
      }

      const resData = resSnap.data();
      const lostUnits = damagedQty + missingQty;
      const nextBorrowed = Math.max(0, (Number(resData.borrowedQuantity) || 0) - qty);
      const nextAvail = (Number(resData.availableQuantity) || 0) + reusableQty;
      const nextTotal = Math.max(0, (Number(resData.totalQuantity) || 0) - lostUnits);
      const now = new Date().toISOString();

      const nextResStatus = computeResourceStatus({
        ...resData,
        totalQuantity: nextTotal,
        availableQuantity: nextAvail,
        borrowedQuantity: nextBorrowed,
      });

      t.update(resRef, {
        totalQuantity: nextTotal,
        availableQuantity: nextAvail,
        borrowedQuantity: nextBorrowed,
        status: nextResStatus,
        updatedAt: now,
      });

      const derivedCondition =
        returnCondition ||
        (damagedQty === 0 && missingQty === 0
          ? 'Good'
          : reusableQty > 0
            ? 'Partially Damaged'
            : 'Damaged/Missing');

      const verification = {
        reusable: reusableQty,
        damaged: damagedQty,
        missing: missingQty,
        verifiedAt: now,
      };

      t.update(reqRef, {
        status: 'Completed',
        returnCondition: derivedCondition,
        actualReturnDate: now,
        verification,
        updatedAt: now,
      });

      return {
        ...reqData,
        requestId,
        status: 'Completed',
        returnCondition: derivedCondition,
        actualReturnDate: now,
        verification,
        updatedAt: now,
      };
    });

    return sendSuccess(res, 'Return verified and completed', updated);
  } catch (err) {
    if (err.status) {
      return sendError(res, err.message, err.code, err.status);
    }
    console.error('verifyReturn error:', err);
    return sendError(res, 'Failed to verify return', 'INTERNAL_ERROR', 500);
  }
};

/**
 * GET /api/sustainability
 * Computes reuse & sustainability impact metrics from Completed borrowing requests
 */
export const getSustainabilityMetrics = async (req, res) => {
  try {
    const { clubId } = req.query;
    const [clubsSnap, resourcesSnap, requestsSnap] = await Promise.all([
      db.collection('Clubs').get(),
      db.collection('Resources').get(),
      db.collection('BorrowingRequests').get(),
    ]);

    const resourceMap = new Map();
    resourcesSnap.forEach((doc) => {
      const d = doc.data();
      resourceMap.set(d.resourceId || doc.id, d);
    });

    let activeClubs = 0;
    clubsSnap.forEach((doc) => {
      if (doc.data().isActive !== false) activeClubs++;
    });

    let completedTransactions = 0;
    let totalReusedUnits = 0;
    let estimatedCostSavedRM = 0;
    let estimatedWasteAvoidedKg = 0;

    requestsSnap.forEach((doc) => {
      const r = doc.data();
      if (r.status !== 'Completed') return;
      if (clubId && r.ownerClubId !== clubId && r.borrowerClubId !== clubId) return;

      completedTransactions++;
      const reused = r.verification?.reusable !== undefined ? Number(r.verification.reusable) : Number(r.quantity) || 0;
      totalReusedUnits += reused;

      if (r.wouldHavePurchased !== false) {
        const resDoc = resourceMap.get(r.resourceId);
        const unitCost = Number(resDoc?.estimatedUnitCost) || 0;
        const unitWeight = Number(resDoc?.estimatedUnitWeight) || 0;
        estimatedCostSavedRM += reused * unitCost;
        estimatedWasteAvoidedKg += reused * unitWeight;
      }
    });

    return sendSuccess(res, 'Sustainability metrics retrieved successfully', {
      completedTransactions,
      totalReusedUnits,
      estimatedCostSavedRM: Math.round(estimatedCostSavedRM * 100) / 100,
      estimatedWasteAvoidedKg: Math.round(estimatedWasteAvoidedKg * 100) / 100,
      activeClubs,
      totalClubs: clubsSnap.size,
      disclaimer:
        'Figures are estimated savings based on completed borrowing records where borrowers indicated they would otherwise have purchased the item.',
    });
  } catch (err) {
    console.error('getSustainabilityMetrics error:', err);
    return sendError(res, 'Failed to compute sustainability metrics', 'INTERNAL_ERROR', 500);
  }
};
