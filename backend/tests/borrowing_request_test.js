
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/server.js';
import { auth, db } from '../src/config/firebase.js';
import dotenv from 'dotenv';
import { calculateResourceStatus } from '../src/utils/resourceStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const timestamp = Date.now();
const testPrefix = `TEST_BORROWING_${timestamp}`;

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const API_KEY = process.env.FIREBASE_WEB_API_KEY;
const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;
const testEmails = [
  `requester_${timestamp}@eventpool.test`,
  `owner_${timestamp}@eventpool.test`,
  `unrelated_${timestamp}@eventpool.test`,
];

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName} ${details ? `(${details})` : ''}`);
    failedCount++;
  }
}

async function getIdTokenForUid(uid) {
  const customToken = await auth.createCustomToken(uid);

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true
      })
    }
  );

  const data = await res.json();

  if (!data.idToken) {
    throw new Error(`Admin token exchange failed: ${JSON.stringify(data)}`);
  }

  return data.idToken;
}

async function getIdTokenWithPassword(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    }
  );

  const data = await res.json();

  if (!data.idToken) {
    throw new Error(`Club login failed: ${JSON.stringify(data)}`);
  }

  return data.idToken;
}

async function runTests() {
  console.log('\n==============================================');
  console.log(' BORROWING REQUEST TEST - BE-06 TO BE-10');
  console.log('==============================================\n');

  if (!API_KEY) {
    throw new Error('FIREBASE_WEB_API_KEY is missing from .env');
  }

  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(TEST_PORT, resolve);
  });

  console.log(`[TEST RUNNER] Server started at ${BASE_URL}`);
  console.log(`[TEST RUNNER] Test prefix: ${testPrefix}\n`);

  try {

    // BE-09: Direct Resource Status Helper Tests
    console.log('--- BE-09 Resource Status Helper Tests ---');

    assert(
      calculateResourceStatus({
        availableQuantity: 5,
        reservedQuantity: 2,
        borrowedQuantity: 1,
        isTemporarilyUnavailable: false
      }) === 'Available',
      'Resource status is Available when available quantity is positive'
    );

    assert(
      calculateResourceStatus({
        availableQuantity: 0,
        reservedQuantity: 2,
        borrowedQuantity: 1,
        isTemporarilyUnavailable: false
      }) === 'Reserved',
      'Resource status is Reserved when only reserved and borrowed quantities remain'
    );

    assert(
      calculateResourceStatus({
        availableQuantity: 0,
        reservedQuantity: 0,
        borrowedQuantity: 2,
        isTemporarilyUnavailable: false
      }) === 'Borrowed',
      'Resource status is Borrowed when all available units are borrowed'
    );

    assert(
      calculateResourceStatus({
        availableQuantity: 5,
        reservedQuantity: 0,
        borrowedQuantity: 0,
        isTemporarilyUnavailable: true
      }) === 'Unavailable',
      'Temporarily unavailable overrides inventory status'
    );

        let zeroInventoryThrows = false;

    try {
      calculateResourceStatus({
        availableQuantity: 0,
        reservedQuantity: 0,
        borrowedQuantity: 0,
        isTemporarilyUnavailable: false
      });
    } catch {
      zeroInventoryThrows = true;
    }

    assert(
      zeroInventoryThrows,
      'Zero inventory without temporary unavailability throws an error'
    );

    // Step 1: Get Admin token
    console.log('--- Step 1: Admin Authentication ---');

    const adminsSnap = await db.collection('Admins').limit(1).get();

    if (adminsSnap.empty) {
      throw new Error('No Admin document found');
    }

    const adminDoc = adminsSnap.docs[0];
    const adminUid = adminDoc.data().adminId || adminDoc.id;

    const adminToken = await getIdTokenForUid(adminUid);

    assert(Boolean(adminToken), 'Admin authentication successful');

    // Step 2: Create Requester Club
    console.log('\n--- Step 2: Create Requester Club ---');

    const requesterEmail = testEmails[0];
    const requesterPassword = 'Password123!';

    const requesterRes = await fetch(`${BASE_URL}/admin/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        clubName: `${testPrefix}_REQUESTER`,
        description: 'Temporary borrowing request test club',
        contactEmail: requesterEmail,
        picContactNum: '0112233445',
        password: requesterPassword
      })
    });

    const requesterBody = await requesterRes.json();

    assert(
      requesterRes.status === 201,
      'Requester Club created',
      JSON.stringify(requesterBody)
    );

    const requesterClubId = requesterBody.data?.clubId;

    assert(Boolean(requesterClubId), 'Requester Club ID received');

    // Step 3: Create Owner Club
    console.log('\n--- Step 3: Create Owner Club ---');

    const ownerEmail = testEmails[1];
    const ownerPassword = 'Password123!';

    const ownerRes = await fetch(`${BASE_URL}/admin/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        clubName: `${testPrefix}_OWNER`,
        description: 'Temporary resource owner test club',
        contactEmail: ownerEmail,
        picContactNum: '0119988776',
        password: ownerPassword
      })
    });

    const ownerBody = await ownerRes.json();

    assert(
      ownerRes.status === 201,
      'Owner Club created',
      JSON.stringify(ownerBody)
    );

    const ownerClubId = ownerBody.data?.clubId;

    assert(Boolean(ownerClubId), 'Owner Club ID received');

    // Step 4: Club Login
    console.log('\n--- Step 4: Club Authentication ---');

    const requesterToken = await getIdTokenWithPassword(
      requesterEmail,
      requesterPassword
    );

    const ownerToken = await getIdTokenWithPassword(
      ownerEmail,
      ownerPassword
    );

    assert(Boolean(requesterToken), 'Requester Club login successful');
    assert(Boolean(ownerToken), 'Owner Club login successful');


    // Step 5: Create Event under Requester Club
    console.log('\n--- Step 5: Create Test Event ---');

    const eventRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requesterToken}`
      },
      body: JSON.stringify({
        eventName: `${testPrefix}_EVENT`,
        eventDate: '2027-01-15',
        purpose: 'Borrowing request integration test',
        description: 'Temporary test event'
      })
    });

    const eventBody = await eventRes.json();
    const eventId = eventBody.data?.eventId;

    assert(
      eventRes.status === 201,
      'Test Event created',
      JSON.stringify(eventBody)
    );

    assert(Boolean(eventId), 'Event ID received');
    assert(
      eventBody.data?.clubId === requesterClubId,
      'Event belongs to Requester Club'
    );

    // Step 6: Create Resource under Owner Club
    console.log('\n--- Step 6: Create Test Resource ---');

    const resourceRes = await fetch(`${BASE_URL}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        itemName: `${testPrefix}_RESOURCE`,
        category: 'Electronics',
        description: 'Temporary borrowing request test resource',
        totalQuantity: 10,
        condition: 'Good',
        location: 'Test Location',
        estimatedUnitCost: 100,
        estimatedUnitWeight: 1
      })
    });

    const resourceBody = await resourceRes.json();
    const resourceId = resourceBody.data?.resourceId;

    assert(
      resourceRes.status === 201,
      'Test Resource created',
      JSON.stringify(resourceBody)
    );

    assert(Boolean(resourceId), 'Resource ID received');
    assert(
      resourceBody.data?.status === 'Available',
      'Initial resource status is Available'
    );
    assert(
      resourceBody.data?.availableQuantity === 10,
      'Initial available quantity is 10'
    );

    console.log('\n--- Test Event and Resource Created ---');
    console.log(`Event ID: ${eventId}`);
    console.log(`Resource ID: ${resourceId}`);


    console.log('\n--- Test Environment Created ---');
    console.log(`Requester Club ID: ${requesterClubId}`);
    console.log(`Owner Club ID: ${ownerClubId}`);
    console.log(`Test Prefix: ${testPrefix}`);


    // Step 7: BE-06 Submit Borrowing Request
    console.log('\n--- Step 7: BE-06 Submit Borrowing Request ---');

    const requestPayload = {
      resourceId,
      eventId,
      quantity: 3,
      purpose: 'Borrowing resources for integration testing',
      pickupDate: '2026-12-10T10:00:00.000Z',
      expectedReturnDate: '2026-12-12T18:00:00.000Z',
      wouldHavePurchased: false,
      remarks: 'TEST_BORROWING request'
    };

    const submitRes = await fetch(`${BASE_URL}/borrowing-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requesterToken}`
      },
      body: JSON.stringify(requestPayload)
    });

    const submitBody = await submitRes.json();
    const requestId = submitBody.data?.requestId;

    assert(
      submitRes.status === 201,
      'Submit borrowing request returns 201',
      JSON.stringify(submitBody)
    );

    assert(Boolean(requestId), 'Borrowing Request ID received');

    assert(
      submitBody.data?.status === 'Pending',
      'New request status is Pending'
    );

    // Verify inventory is unchanged after submission
    const resourceAfterSubmit = await db
      .collection('Resources')
      .doc(resourceId)
      .get();

    const inventoryAfterSubmit = resourceAfterSubmit.data();

    assert(
      inventoryAfterSubmit.availableQuantity === 10,
      'Available quantity remains 10 after submission'
    );

    assert(
      inventoryAfterSubmit.reservedQuantity === 0,
      'Reserved quantity remains 0 after submission'
    );

    assert(
      inventoryAfterSubmit.borrowedQuantity === 0,
      'Borrowed quantity remains 0 after submission'
    );

    // Verify invalid quantity is rejected
    const invalidSubmitRes = await fetch(
      `${BASE_URL}/borrowing-requests`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requesterToken}`
        },
        body: JSON.stringify({
          ...requestPayload,
          quantity: 0
        })
      }
    );

    const invalidSubmitBody = await invalidSubmitRes.json();

    assert(
      invalidSubmitRes.status === 400,
      'Reject borrowing request with quantity 0',
      JSON.stringify(invalidSubmitBody)
    );

    // Verify requester cannot borrow its own resource
    const ownResourceRes = await fetch(`${BASE_URL}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requesterToken}`
      },
      body: JSON.stringify({
        itemName: `${testPrefix}_OWN_RESOURCE`,
        category: 'Electronics',
        description: 'Own resource negative test',
        totalQuantity: 5,
        condition: 'Good',
        location: 'Test Location',
        estimatedUnitCost: 100,
        estimatedUnitWeight: 1
      })
    });

    const ownResourceBody = await ownResourceRes.json();
    const ownResourceId = ownResourceBody.data?.resourceId;

    assert(
      ownResourceRes.status === 201 && Boolean(ownResourceId),
      'Create requester own resource for negative test',
      JSON.stringify(ownResourceBody)
    );

    if (ownResourceId) {
      const ownResourceRequestRes = await fetch(
        `${BASE_URL}/borrowing-requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${requesterToken}`
          },
          body: JSON.stringify({
            ...requestPayload,
            resourceId: ownResourceId
          })
        }
      );

    const ownResourceRequestBody = await ownResourceRequestRes.json();

    assert(
    ownResourceRequestRes.status === 403 &&
    ownResourceRequestBody.error?.code === 'FORBIDDEN',
    'Requester cannot borrow its own resource',
    JSON.stringify(ownResourceRequestBody)
    );}

    console.log(`Borrowing Request ID: ${requestId}`);


    // Step 8: BE-07 Approve / Reject Borrowing Request
    console.log('\n--- Step 8: BE-07 Approve / Reject Borrowing Request ---');

    // 8.1 Requester must not be allowed to approve the request
    const requesterApproveRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/approve`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${requesterToken}`
        }
      }
    );

    const requesterApproveBody = await requesterApproveRes.json();

    assert(
      requesterApproveRes.status === 403,
      'Requester cannot approve borrowing request',
      JSON.stringify(requesterApproveBody)
    );

    // 8.2 Owner approves the request
    const approveRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/approve`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }
    );

    const approveBody = await approveRes.json();

    assert(
      approveRes.status === 200,
      'Owner approves borrowing request',
      JSON.stringify(approveBody)
    );

    assert(
      approveBody.data?.status === 'Approved',
      'Request status changes to Approved',
      JSON.stringify(approveBody)
    );

    // 8.3 Verify inventory after approval
    const resourceAfterApproval = await db
      .collection('Resources')
      .doc(resourceId)
      .get();

    const inventoryAfterApproval = resourceAfterApproval.data();

    assert(
      inventoryAfterApproval.availableQuantity === 7,
      'Available quantity decreases from 10 to 7'
    );

    assert(
      inventoryAfterApproval.reservedQuantity === 3,
      'Reserved quantity increases from 0 to 3'
    );

    assert(
      inventoryAfterApproval.borrowedQuantity === 0,
      'Borrowed quantity remains 0 after approval'
    );

    assert(
      inventoryAfterApproval.totalQuantity === 10,
      'Total quantity remains 10 after approval'
    );

    // 8.4 Verify duplicate approval is rejected
    const duplicateApproveRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/approve`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }
    );

    const duplicateApproveBody = await duplicateApproveRes.json();

    assert(
      duplicateApproveRes.status === 409 &&
      duplicateApproveBody.error?.code === 'REQUEST_ALREADY_PROCESSED',
      'Duplicate approval is rejected',
      JSON.stringify(duplicateApproveBody)
    );

    // 8.5 Create another Pending request for rejection test
    const rejectRequestRes = await fetch(
      `${BASE_URL}/borrowing-requests`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requesterToken}`
        },
        body: JSON.stringify({
          ...requestPayload,
          quantity: 1,
          remarks: 'TEST_BORROWING rejection test'
        })
      }
    );

    const rejectRequestBody = await rejectRequestRes.json();
    const rejectRequestId = rejectRequestBody.data?.requestId;

    assert(
      rejectRequestRes.status === 201 && Boolean(rejectRequestId),
      'Create second Pending request for rejection test',
      JSON.stringify(rejectRequestBody)
    );

    // 8.6 Owner rejects the second request
    if (rejectRequestId) {
      const rejectRes = await fetch(
        `${BASE_URL}/borrowing-requests/${rejectRequestId}/reject`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`
          },
          body: JSON.stringify({
            rejectionRemarks: 'Rejected for integration testing'
          })
        }
      );

      const rejectBody = await rejectRes.json();

      assert(
        rejectRes.status === 200,
        'Owner rejects borrowing request',
        JSON.stringify(rejectBody)
      );

      assert(
        rejectBody.data?.status === 'Rejected',
        'Request status changes to Rejected',
        JSON.stringify(rejectBody)
      );

      // 8.7 Verify rejection does not change inventory
      const resourceAfterRejection = await db
        .collection('Resources')
        .doc(resourceId)
        .get();

      const inventoryAfterRejection = resourceAfterRejection.data();

      assert(
        inventoryAfterRejection.availableQuantity === 7,
        'Available quantity remains 7 after rejection'
      );

      assert(
        inventoryAfterRejection.reservedQuantity === 3,
        'Reserved quantity remains 3 after rejection'
      );

      assert(
        inventoryAfterRejection.borrowedQuantity === 0,
        'Borrowed quantity remains 0 after rejection'
      );
    }



    // Step 9: BE-08 Get Borrowing Requests
    console.log('\n--- Step 9: BE-08 Get Borrowing Requests ---');

    // 9.1 Requester retrieves their borrowing requests
    const requesterListRes = await fetch(
      `${BASE_URL}/borrowing-requests`,
      {
        headers: {
          Authorization: `Bearer ${requesterToken}`
        }
      }
    );

    const requesterListBody = await requesterListRes.json();
    const requesterRequests = requesterListBody.data?.requests || [];

    assert(
      requesterListRes.status === 200,
      'Requester can retrieve borrowing request list',
      JSON.stringify(requesterListBody)
    );

    assert(
      requesterRequests.some((r) => r.requestId === requestId),
      'Requester list contains their submitted request'
    );

    // 9.2 Owner retrieves requests involving their resources
    const ownerListRes = await fetch(
      `${BASE_URL}/borrowing-requests`,
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }
    );

    const ownerListBody = await ownerListRes.json();
    const ownerRequests = ownerListBody.data?.requests || [];

    assert(
      ownerListRes.status === 200,
      'Owner can retrieve borrowing request list',
      JSON.stringify(ownerListBody)
    );

    assert(
      ownerRequests.some((r) => r.requestId === requestId),
      'Owner list contains the request for their resource'
    );

    // 9.3 Admin retrieves borrowing requests
    const adminListRes = await fetch(
      `${BASE_URL}/borrowing-requests`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    const adminListBody = await adminListRes.json();

    assert(
      adminListRes.status === 200,
      'Admin can retrieve borrowing request list',
      JSON.stringify(adminListBody)
    );

    // 9.4 Filter by status and resourceId
    const filterUrl = new URL(`${BASE_URL}/borrowing-requests`);

    filterUrl.searchParams.set('status', 'Approved');
    filterUrl.searchParams.set('resourceId', resourceId);

    const filterRes = await fetch(filterUrl, {
      headers: {
        Authorization: `Bearer ${ownerToken}`
      }
    });

    const filterBody = await filterRes.json();
    const filteredRequests = filterBody.data?.requests || [];

    assert(
      filterRes.status === 200,
      'Filter requests by status and resourceId',
      JSON.stringify(filterBody)
    );

    assert(
      filteredRequests.length === 1 &&
      filteredRequests[0].requestId === requestId &&
      filteredRequests[0].status === 'Approved',
      'Filtered result contains only the matching Approved request'
    );

    // 9.5 Pagination
    const paginationRes = await fetch(
      `${BASE_URL}/borrowing-requests?page=1&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${requesterToken}`
        }
      }
    );

    const paginationBody = await paginationRes.json();
    const pagination = paginationBody.data?.pagination;
    const paginatedRequests = paginationBody.data?.requests || [];

    assert(
      paginationRes.status === 200,
      'Pagination request returns 200',
      JSON.stringify(paginationBody)
    );

    assert(
      pagination?.page === 1 &&
      pagination?.limit === 1 &&
      paginatedRequests.length === 1,
      'Pagination returns one request for page 1'
    );

    // 9.6 Requester retrieves request detail
    const requesterDetailRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}`,
      {
        headers: {
          Authorization: `Bearer ${requesterToken}`
        }
      }
    );

    const requesterDetailBody = await requesterDetailRes.json();

    assert(
      requesterDetailRes.status === 200,
      'Requester can retrieve request detail',
      JSON.stringify(requesterDetailBody)
    );

    assert(
      requesterDetailBody.data?.requestId === requestId,
      'Requester detail contains the correct request'
    );

    // 9.7 Owner retrieves request detail
    const ownerDetailRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}`,
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }
    );

    const ownerDetailBody = await ownerDetailRes.json();

    assert(
      ownerDetailRes.status === 200,
      'Owner can retrieve request detail',
      JSON.stringify(ownerDetailBody)
    );

    // 9.8 Create an unrelated Club for access-control test
    const unrelatedEmail = testEmails[2];
    const unrelatedPassword = 'Password123!';

    const unrelatedClubRes = await fetch(`${BASE_URL}/admin/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        clubName: `${testPrefix}_UNRELATED`,
        description: 'Unrelated club for access control test',
        contactEmail: unrelatedEmail,
        picContactNum: '0115566778',
        password: unrelatedPassword
      })
    });

    const unrelatedClubBody = await unrelatedClubRes.json();

    assert(
      unrelatedClubRes.status === 201,
      'Create unrelated Club for access-control test',
      JSON.stringify(unrelatedClubBody)
    );

    if (unrelatedClubRes.status === 201) {
      const unrelatedToken = await getIdTokenWithPassword(
        unrelatedEmail,
        unrelatedPassword
      );

      // 9.9 Unrelated Club must not access request detail
      const unauthorizedDetailRes = await fetch(
        `${BASE_URL}/borrowing-requests/${requestId}`,
        {
          headers: {
            Authorization: `Bearer ${unrelatedToken}`
          }
        }
      );

      const unauthorizedDetailBody = await unauthorizedDetailRes.json();

      assert(
        unauthorizedDetailRes.status === 403 &&
        unauthorizedDetailBody.error?.code === 'FORBIDDEN',
        'Unrelated Club cannot retrieve request detail',
        JSON.stringify(unauthorizedDetailBody)
      );
    }

    // 9.10 Non-existent request returns 404
    const missingDetailRes = await fetch(
      `${BASE_URL}/borrowing-requests/DOES_NOT_EXIST_TEST`,
      {
        headers: {
          Authorization: `Bearer ${requesterToken}`
        }
      }
    );

    const missingDetailBody = await missingDetailRes.json();

    assert(
      missingDetailRes.status === 404 &&
      missingDetailBody.error?.code === 'REQUEST_NOT_FOUND',
      'Non-existent request returns 404',
      JSON.stringify(missingDetailBody)
    );


    // Step 10: BE-09 Mark Resource as Borrowed
    console.log('\n--- Step 10: BE-09 Mark Resource as Borrowed ---');

    // 10.1 Requester cannot mark resource as borrowed
    const requesterBorrowRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/borrow`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${requesterToken}`
        }
      }
    );

    const requesterBorrowBody = await requesterBorrowRes.json();

    assert(
      requesterBorrowRes.status === 403,
      'Requester cannot mark resource as borrowed',
      JSON.stringify(requesterBorrowBody)
    );

    // 10.2 Owner marks resource as borrowed
    const markBorrowedRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/borrow`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }
    );

    const markBorrowedBody = await markBorrowedRes.json();

    assert(
      markBorrowedRes.status === 200,
      'Owner marks resource as borrowed',
      JSON.stringify(markBorrowedBody)
    );

    assert(
      markBorrowedBody.data?.status === 'Borrowed',
      'Request status changes to Borrowed'
    );

    // 10.3 Verify inventory after marking as borrowed
    const resourceAfterBorrowed = await db
      .collection('Resources')
      .doc(resourceId)
      .get();

    const borrowedInventory = resourceAfterBorrowed.data();

    assert(
      borrowedInventory.availableQuantity === 7,
      'Available quantity remains 7'
    );

    assert(
      borrowedInventory.reservedQuantity === 0,
      'Reserved quantity decreases from 3 to 0'
    );

    assert(
      borrowedInventory.borrowedQuantity === 3,
      'Borrowed quantity increases from 0 to 3'
    );

    assert(
      borrowedInventory.totalQuantity === 10,
      'Total quantity remains 10'
    );

    assert(
      borrowedInventory.status === 'Available',
      'Resource status remains Available when available quantity is positive'
    );

    // 10.4 Duplicate mark as borrowed must be rejected
    const duplicateBorrowRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/borrow`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }
    );

    const duplicateBorrowBody = await duplicateBorrowRes.json();

    assert(
      duplicateBorrowRes.status === 409 &&
      duplicateBorrowBody.error?.code === 'INVALID_STATUS_TRANSITION',
      'Duplicate mark as borrowed is rejected',
      JSON.stringify(duplicateBorrowBody)
    );


    // Step 11: BE-10 Submit Return and Complete Borrowing Request
    console.log('\n--- Step 11: BE-10 Return and Complete ---');

    const actualReturnDate = '2026-12-12T17:00:00.000Z';

    // 11.1 Owner cannot submit return on behalf of requester
    const ownerReturnRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/return`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          actualReturnDate,
          remarks: 'Return submitted by owner'
        })
      }
    );

    const ownerReturnBody = await ownerReturnRes.json();

    assert(
      ownerReturnRes.status === 403,
      'Owner cannot submit return on behalf of requester',
      JSON.stringify(ownerReturnBody)
    );

    // 11.2 Requester submits return
    const submitReturnRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/return`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${requesterToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          actualReturnDate,
          remarks: 'All items returned to owner'
        })
      }
    );

    const submitReturnBody = await submitReturnRes.json();

    assert(
      submitReturnRes.status === 200,
      'Requester successfully submits return',
      JSON.stringify(submitReturnBody)
    );

    assert(
      submitReturnBody.data?.status === 'Return Pending',
      'Request status changes to Return Pending'
    );

    // 11.3 Verify return information and remarks
    const requestAfterReturn = await db
      .collection('BorrowingRequests')
      .doc(requestId)
      .get();

    const returnData = requestAfterReturn.data();

    assert(
      returnData.status === 'Return Pending',
      'Firestore request status is Return Pending'
    );

    assert(
      returnData.actualReturnDate === actualReturnDate,
      'Actual return date is saved'
    );

    assert(
      returnData.remarks === 'TEST_BORROWING request',
      'Original requester remarks are preserved'
    );

    assert(
      returnData.returnRemarks === 'All items returned to owner',
      'Return remarks are saved separately'
    );

    // 11.4 Inventory must not change when requester submits return
    const inventoryAfterReturn = (
      await db.collection('Resources').doc(resourceId).get()
    ).data();

    assert(
      inventoryAfterReturn.totalQuantity === 10 &&
      inventoryAfterReturn.availableQuantity === 7 &&
      inventoryAfterReturn.reservedQuantity === 0 &&
      inventoryAfterReturn.borrowedQuantity === 3,
      'Inventory remains unchanged while return is pending',
      JSON.stringify(inventoryAfterReturn)
    );

        // 11.4.1 Duplicate return submission must be rejected
    const duplicateReturnRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/return`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${requesterToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          actualReturnDate,
          remarks: 'Duplicate return submission'
        })
      }
    );

    const duplicateReturnBody = await duplicateReturnRes.json();

    assert(
      duplicateReturnRes.status === 409 &&
      duplicateReturnBody.error?.code === 'INVALID_STATUS_TRANSITION',
      'Duplicate return submission is rejected',
      JSON.stringify(duplicateReturnBody)
    );

    // 11.5 Requester cannot complete return verification
    const requesterCompleteRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/complete`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${requesterToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          returnedQuantity: 2,
          usableQuantity: 2,
          damagedQuantity: 0,
          missingQuantity: 1,
          returnCondition: 'Good',
          remarks: 'Verified by requester'
        })
      }
    );

    const requesterCompleteBody = await requesterCompleteRes.json();

    assert(
      requesterCompleteRes.status === 403,
      'Requester cannot complete return verification',
      JSON.stringify(requesterCompleteBody)
    );

    // 11.6 Invalid return quantities must be rejected
    const invalidCompleteRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/complete`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          returnedQuantity: 3,
          usableQuantity: 2,
          damagedQuantity: 0,
          missingQuantity: 1,
          returnCondition: 'Good',
          remarks: 'Invalid quantity test'
        })
      }
    );

    const invalidCompleteBody = await invalidCompleteRes.json();

    assert(
      invalidCompleteRes.status === 400 &&
      invalidCompleteBody.error?.code === 'INVALID_RETURN_QUANTITY',
      'Inconsistent return quantities are rejected',
      JSON.stringify(invalidCompleteBody)
    );

    // 11.7 Owner completes return verification
    const completeRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/complete`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          returnedQuantity: 2,
          usableQuantity: 2,
          damagedQuantity: 0,
          missingQuantity: 1,
          returnCondition: 'Good',
          remarks: 'Verified by owner'
        })
      }
    );

    const completeBody = await completeRes.json();

    assert(
      completeRes.status === 200,
      'Owner successfully completes return verification',
      JSON.stringify(completeBody)
    );

    assert(
      completeBody.data?.status === 'Completed',
      'Response status is Completed'
    );

    // 11.8 Verify final borrowing request record
    const completedRequest = (
      await db.collection('BorrowingRequests').doc(requestId).get()
    ).data();

    assert(
      completedRequest.status === 'Completed',
      'Firestore request status is Completed'
    );

    assert(
      completedRequest.returnedQuantity === 2 &&
      completedRequest.usableQuantity === 2 &&
      completedRequest.damagedQuantity === 0 &&
      completedRequest.missingQuantity === 1,
      'Return quantities are saved correctly'
    );

    assert(
      completedRequest.returnCondition === 'Good',
      'Return condition is saved'
    );

    assert(
      typeof completedRequest.returnVerifiedAt === 'string' &&
      completedRequest.returnVerifiedAt.length > 0,
      'Return verification timestamp is recorded'
    );

    assert(
      completedRequest.remarks === 'TEST_BORROWING request',
      'Original requester remarks remain unchanged after completion'
    );

    assert(
      completedRequest.returnRemarks === 'All items returned to owner',
      'Requester return remarks remain unchanged after completion'
    );

    assert(
      completedRequest.verificationRemarks === 'Verified by owner',
      'Owner verification remarks are saved separately'
    );

    // 11.9 Verify final resource inventory
    const finalResource = (
      await db.collection('Resources').doc(resourceId).get()
    ).data();

    assert(
      finalResource.totalQuantity === 9,
      'Total quantity decreases from 10 to 9'
    );

    assert(
      finalResource.availableQuantity === 9,
      'Available quantity increases from 7 to 9'
    );

    assert(
      finalResource.reservedQuantity === 0,
      'Reserved quantity remains 0'
    );

    assert(
      finalResource.borrowedQuantity === 0,
      'Borrowed quantity decreases from 3 to 0'
    );

    assert(
      finalResource.status === 'Available',
      'Final resource status is Available'
    );

    assert(
      finalResource.totalQuantity ===
      finalResource.availableQuantity +
      finalResource.reservedQuantity +
      finalResource.borrowedQuantity,
      'Final inventory invariant is maintained'
    );

        // 11.10 Duplicate completion must be rejected
    const duplicateCompleteRes = await fetch(
      `${BASE_URL}/borrowing-requests/${requestId}/complete`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          returnedQuantity: 2,
          usableQuantity: 2,
          damagedQuantity: 0,
          missingQuantity: 1,
          returnCondition: 'Good',
          remarks: 'Duplicate completion test'
        })
      }
    );

    const duplicateCompleteBody = await duplicateCompleteRes.json();

    assert(
      duplicateCompleteRes.status === 409 &&
      duplicateCompleteBody.error?.code === 'INVALID_STATUS_TRANSITION',
      'Duplicate completion is rejected',
      JSON.stringify(duplicateCompleteBody)
    );

    console.log('\n==============================================');
    console.log(`RESULT: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('==============================================\n');
  } catch (err) {
    console.error('\nFatal test error:', err);
    failedCount++;
  } finally {
    console.log('[CLEANUP] Purging temporary TEST_BORROWING_* records and Auth users...');
    try {
      const testClubIds = new Set();
      const clubsSnap = await db.collection('Clubs').get();
      for (const doc of clubsSnap.docs) {
        const d = doc.data();
        if (
          String(d.clubName || '').startsWith(testPrefix) ||
          testEmails.includes(d.contactEmail)
        ) {
          testClubIds.add(d.clubId || doc.id);
        }
      }

      const [evtsSnap, resSnap, reqsSnap] = await Promise.all([
        db.collection('Events').get(),
        db.collection('Resources').get(),
        db.collection('BorrowingRequests').get(),
      ]);

      const eventIds = new Set();
      for (const doc of evtsSnap.docs) {
        const d = doc.data();
        if (testClubIds.has(d.clubId) || String(d.eventName || '').startsWith(testPrefix)) {
          eventIds.add(d.eventId || doc.id);
        }
      }
      const resourceIds = new Set();
      for (const doc of resSnap.docs) {
        const d = doc.data();
        if (testClubIds.has(d.clubId) || String(d.itemName || '').startsWith(testPrefix)) {
          resourceIds.add(d.resourceId || doc.id);
        }
      }
      const requestIds = new Set();
      for (const doc of reqsSnap.docs) {
        const d = doc.data();
        if (
          testClubIds.has(d.ownerClubId) ||
          testClubIds.has(d.requesterClubId) ||
          testClubIds.has(d.borrowerClubId) ||
          resourceIds.has(d.resourceId) ||
          eventIds.has(d.eventId) ||
          String(d.remarks || '').includes(`TEST_BORROWING_${timestamp}`)
        ) {
          requestIds.add(doc.id);
        }
      }

      await Promise.all([
        ...reqsSnap.docs
          .filter((doc) => requestIds.has(doc.id))
          .map((doc) => doc.ref.delete()),
        ...resSnap.docs
          .filter((doc) => resourceIds.has(doc.data().resourceId || doc.id))
          .map((doc) => doc.ref.delete()),
        ...evtsSnap.docs
          .filter((doc) => eventIds.has(doc.data().eventId || doc.id))
          .map((doc) => doc.ref.delete()),
        ...clubsSnap.docs
          .filter((doc) => testClubIds.has(doc.data().clubId || doc.id))
          .map((doc) => doc.ref.delete()),
      ]);

      for (const email of testEmails) {
        try {
          const user = await auth.getUserByEmail(email);
          await auth.deleteUser(user.uid);
        } catch (cleanupErr) {
          if (cleanupErr.code !== 'auth/user-not-found') throw cleanupErr;
        }
      }
      console.log('[CLEANUP] Complete! Zero test pollution remaining.');
    } catch (cleanupErr) {
      console.error('[CLEANUP] Failed:', cleanupErr);
      failedCount++;
    }
    try {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await db.terminate();
    } catch (shutdownErr) {
      console.error('[SHUTDOWN] Failed:', shutdownErr);
      failedCount++;
    }
    process.exitCode = failedCount > 0 ? 1 : 0;
  }
}

runTests();
