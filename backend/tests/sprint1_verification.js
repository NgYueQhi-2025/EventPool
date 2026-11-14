import http from 'http';
import app from '../src/server.js';
import { auth, db } from '../src/config/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCuxj4pY_b0wDq298coBMXtVm-FdDrLRuQ';
const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${testName}`);
    passedCount++;
  } else {
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${testName} ${details ? `(${details})` : ''}`);
    failedCount++;
  }
}

// Exchange custom token for real Firebase ID Token via REST API
async function getIdTokenForUid(uid) {
  const customToken = await auth.createCustomToken(uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`Failed to exchange custom token for UID ${uid}: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

// Sign in with password via REST API
async function getIdTokenWithPassword(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`Failed to sign in with password for ${email}: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function runTests() {
  console.log('\n============================================================');
  console.log('       EventPool Backend (BE-01 to BE-05) Verification      ');
  console.log('============================================================\n');

  // Start test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[TEST RUNNER] In-memory server listening on ${BASE_URL}\n`);

  try {
    // 0. Locate Admin UID
    console.log('--- Step 0: Identify Admin Profile ---');
    const adminsSnap = await db.collection('Admins').limit(1).get();
    if (adminsSnap.empty) {
      throw new Error('No admin document found in Admins collection!');
    }
    const adminDoc = adminsSnap.docs[0];
    const adminUid = adminDoc.data().adminId || adminDoc.id;
    console.log(`Found Admin document UID: ${adminUid}`);

    const adminToken = await getIdTokenForUid(adminUid);
    assert(Boolean(adminToken), 'Minted valid Firebase ID Token for Admin');

    // 1. BE-01 & BE-05: Admin Profile & Club Management
    console.log('\n--- Step 1: Admin Profile & Club Creation (BE-01, BE-05) ---');
    
    // GET /api/admin/profile
    const adminProfileRes = await fetch(`${BASE_URL}/admin/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminProfileBody = await adminProfileRes.json();
    assert(adminProfileRes.status === 200, 'GET /api/admin/profile returns 200 OK');
    assert(adminProfileBody.success === true && adminProfileBody.data?.adminId === adminUid, 'Admin profile data matches UID');

    // GET /api/auth/profile for Admin
    const authProfileRes = await fetch(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const authProfileBody = await authProfileRes.json();
    assert(authProfileRes.status === 200, 'GET /api/auth/profile returns 200 for Admin');
    assert(authProfileBody.data?.accountType === 'admin', 'Account type is reported as admin');

    // POST /api/admin/clubs (Create Club A)
    const timestamp = Date.now();
    const clubAEmail = `club_a_${timestamp}@eventpool.test`;
    const clubAPassword = 'Password123!';
    const createClubARes = await fetch(`${BASE_URL}/admin/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        clubName: `Robotics Club ${timestamp}`,
        description: 'Building autonomous robots and hardware',
        contactEmail: clubAEmail,
        picContactNum: '0112233445',
        password: clubAPassword
      })
    });
    const createClubABody = await createClubARes.json();
    assert(createClubARes.status === 201, 'POST /api/admin/clubs creates Club A with 201 Created');
    const clubAId = createClubABody.data?.clubId;
    assert(Boolean(clubAId), `Club A created with ID: ${clubAId}`);

    // Test duplicate email rejection (409)
    const dupClubRes = await fetch(`${BASE_URL}/admin/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        clubName: 'Duplicate Email Club',
        contactEmail: clubAEmail,
        picContactNum: '0119988776',
        password: 'Password123!'
      })
    });
    const dupClubBody = await dupClubRes.json();
    assert(dupClubRes.status === 409, 'POST /api/admin/clubs rejects duplicate email with 409 Conflict');
    assert(dupClubBody.error?.code === 'EMAIL_ALREADY_EXISTS', 'Rejection code is EMAIL_ALREADY_EXISTS');

    // Create Club B for cross-club authorization tests
    const clubBEmail = `club_b_${timestamp}@eventpool.test`;
    const clubBPassword = 'Password123!';
    const createClubBRes = await fetch(`${BASE_URL}/admin/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        clubName: `Debate Union ${timestamp}`,
        description: 'Competitive parliamentary debate',
        contactEmail: clubBEmail,
        picContactNum: '0123344556',
        password: clubBPassword
      })
    });
    const createClubBBody = await createClubBRes.json();
    assert(createClubBRes.status === 201, 'POST /api/admin/clubs creates Club B with 201 Created');
    const clubBId = createClubBBody.data?.clubId;

    // 2. Club Login & Role Guard Verification
    console.log('\n--- Step 2: Club Login & Permissions (BE-01, BE-04) ---');
    const clubAToken = await getIdTokenWithPassword(clubAEmail, clubAPassword);
    assert(Boolean(clubAToken), 'Club A signed in with password via REST API');

    // Club profile check
    const clubAProfileRes = await fetch(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${clubAToken}` }
    });
    const clubAProfileBody = await clubAProfileRes.json();
    assert(clubAProfileRes.status === 200, 'GET /api/auth/profile returns 200 for Club A');
    assert(clubAProfileBody.data?.accountType === 'club' && clubAProfileBody.data?.clubId === clubAId, 'Account type is club and clubId matches');

    // Club A attempts Admin endpoint -> Expect 403 FORBIDDEN
    const clubOnAdminRes = await fetch(`${BASE_URL}/admin/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clubAToken}`
      },
      body: JSON.stringify({
        clubName: 'Illegal Club',
        contactEmail: 'illegal@eventpool.test',
        picContactNum: '0000',
        password: 'pwd'
      })
    });
    assert(clubOnAdminRes.status === 403, 'Club account blocked from Admin endpoints with 403 Forbidden');

    // Create Event (BE-04)
    const createEventRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clubAToken}`
      },
      body: JSON.stringify({
        eventName: 'National Robotics Open 2026',
        eventDate: '2026-12-15',
        purpose: 'Annual engineering showcase',
        description: 'Inter-university competition'
      })
    });
    const createEventBody = await createEventRes.json();
    assert(createEventRes.status === 201, 'POST /api/events creates event with 201 Created');
    assert(createEventBody.data?.clubId === clubAId, 'Event is automatically bound to Club A');

    // 3. Resource CRUD & Inventory Logic (BE-02)
    console.log('\n--- Step 3: Resource CRUD & Inventory Logic (BE-02) ---');
    const createResourceRes = await fetch(`${BASE_URL}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clubAToken}`
      },
      body: JSON.stringify({
        itemName: 'Arduino Starter Kit Pro',
        category: 'Electronics',
        description: 'Complete microcontroller kits with sensors',
        totalQuantity: 15,
        condition: 'Good',
        location: 'Engineering Workshop Lab 3',
        estimatedUnitCost: 150,
        estimatedUnitWeight: 0.8
      })
    });
    const createResourceBody = await createResourceRes.json();
    assert(createResourceRes.status === 201, 'POST /api/resources creates resource with 201 Created');
    const resourceId = createResourceBody.data?.resourceId;
    assert(createResourceBody.data?.status === 'Available', 'Resource status initialized as Available');
    assert(createResourceBody.data?.availableQuantity === 15, 'Available quantity matches total quantity');

    // GET /api/resources & Search
    const getResourcesRes = await fetch(`${BASE_URL}/resources?category=Electronics`, {
      headers: { Authorization: `Bearer ${clubAToken}` }
    });
    const getResourcesBody = await getResourcesRes.json();
    assert(getResourcesRes.status === 200, 'GET /api/resources with filter returns 200 OK');
    const foundResource = getResourcesBody.data?.items?.find((r) => r.resourceId === resourceId);
    assert(Boolean(foundResource), 'Created resource is listed in filtered results');

    const searchRes = await fetch(`${BASE_URL}/resources/search?q=Arduino`, {
      headers: { Authorization: `Bearer ${clubAToken}` }
    });
    const searchBody = await searchRes.json();
    assert(searchRes.status === 200, 'GET /api/resources/search returns 200 OK');
    const searchedResource = searchBody.data?.items?.find((r) => r.resourceId === resourceId);
    assert(Boolean(searchedResource), 'Created resource matches keyword search "Arduino"');

    // 4. Resource Image Upload & Validation (BE-03)
    console.log('\n--- Step 4: Resource Image Upload & Validation (BE-03) ---');
    
    // Test invalid mime type (.txt) -> Expect 415 UNSUPPORTED_MEDIA_TYPE
    const textFormData = new FormData();
    textFormData.append('image', new Blob(['fake text content'], { type: 'text/plain' }), 'test.txt');
    const invalidTypeRes = await fetch(`${BASE_URL}/resources/${resourceId}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clubAToken}` },
      body: textFormData
    });
    const invalidTypeBody = await invalidTypeRes.json();
    assert(invalidTypeRes.status === 415, 'Reject non-image file with 415 Unsupported Media Type');
    assert(invalidTypeBody.error?.code === 'UNSUPPORTED_MEDIA_TYPE', 'Error code is UNSUPPORTED_MEDIA_TYPE');

    // Test file too large (>5MB) -> Expect 413 FILE_TOO_LARGE
    const largeBuffer = new Uint8Array(6 * 1024 * 1024); // 6MB
    const largeFormData = new FormData();
    largeFormData.append('image', new Blob([largeBuffer], { type: 'image/png' }), 'large.png');
    const largeFileRes = await fetch(`${BASE_URL}/resources/${resourceId}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clubAToken}` },
      body: largeFormData
    });
    const largeFileBody = await largeFileRes.json();
    assert(largeFileRes.status === 413, 'Reject >5MB image with 413 Payload Too Large');
    assert(largeFileBody.error?.code === 'FILE_TOO_LARGE', 'Error code is FILE_TOO_LARGE');

    // Test valid image upload -> Expect 200 OK
    // 1x1 transparent PNG data
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const validFormData = new FormData();
    validFormData.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'thumbnail.png');
    const validUploadRes = await fetch(`${BASE_URL}/resources/${resourceId}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clubAToken}` },
      body: validFormData
    });
    const validUploadBody = await validUploadRes.json();
    assert(validUploadRes.status === 200, 'POST /api/resources/{id}/image uploads valid PNG with 200 OK');
    assert(Boolean(validUploadBody.data?.imageURL), `Image URL assigned: ${validUploadBody.data?.imageURL}`);

    // GET /api/resources/{id}/image
    const getImageRes = await fetch(`${BASE_URL}/resources/${resourceId}/image`, {
      headers: { Authorization: `Bearer ${clubAToken}` }
    });
    const getImageBody = await getImageRes.json();
    assert(getImageRes.status === 200, 'GET /api/resources/{id}/image returns 200 OK');
    assert(getImageBody.data?.imageURL === validUploadBody.data?.imageURL, 'Fetched image URL matches uploaded URL');

    // 5. Cross-Club Ownership Enforcement (BE-02)
    console.log('\n--- Step 5: Cross-Club Ownership Enforcement ---');
    const clubBToken = await getIdTokenWithPassword(clubBEmail, clubBPassword);
    
    // Club B tries to update Club A's resource -> 403
    const clubBUpdateRes = await fetch(`${BASE_URL}/resources/${resourceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clubBToken}`
      },
      body: JSON.stringify({ itemName: 'Hacked Item Name' })
    });
    assert(clubBUpdateRes.status === 403, 'Club B rejected from updating Club A resource with 403 Forbidden');

    // Club B tries to archive Club A's resource -> 403
    const clubBArchiveRes = await fetch(`${BASE_URL}/resources/${resourceId}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${clubBToken}` }
    });
    assert(clubBArchiveRes.status === 403, 'Club B rejected from archiving Club A resource with 403 Forbidden');

    // 6. Admin Deactivation & Account Block (BE-05, BE-01)
    console.log('\n--- Step 6: Admin Deactivates Club & Verifies Blocking ---');
    const deactivateRes = await fetch(`${BASE_URL}/admin/clubs/${clubAId}/deactivate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const deactivateBody = await deactivateRes.json();
    assert(deactivateRes.status === 200, 'PATCH /api/admin/clubs/{id}/deactivate returns 200 OK');
    assert(deactivateBody.data?.isActive === false, 'Club A isActive set to false');

    // Club A calls protected endpoint -> 403 ACCOUNT_DISABLED
    const blockedRes = await fetch(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${clubAToken}` }
    });
    const blockedBody = await blockedRes.json();
    assert(blockedRes.status === 403, 'Deactivated Club A immediately blocked with 403 Forbidden');
    assert(blockedBody.error?.code === 'ACCOUNT_DISABLED', 'Error code is ACCOUNT_DISABLED');

    // GET /api/admin/dashboard
    const dashboardRes = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const dashboardBody = await dashboardRes.json();
    assert(dashboardRes.status === 200, 'GET /api/admin/dashboard returns 200 OK');
    assert(dashboardBody.data?.totalClubs >= 2, 'Dashboard reflects total clubs count');
    assert(typeof dashboardBody.data?.activeClubs === 'number', 'Dashboard reflects active clubs count');
    assert(dashboardBody.data?.totalResources >= 1, 'Dashboard preserves historical resource records');

    console.log('\n============================================================');
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nFatal test execution error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
