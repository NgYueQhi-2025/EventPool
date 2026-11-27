import { auth, db } from '../src/config/firebase.js';

const toISODate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function upsertAuthUser({ email, password, displayName, disabled = false, preferredUid = null }) {
  let userRecord = null;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }

  if (!userRecord && preferredUid) {
    try {
      userRecord = await auth.getUser(preferredUid);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }
  }

  if (userRecord) {
    userRecord = await auth.updateUser(userRecord.uid, {
      email,
      password,
      displayName,
      disabled,
    });
  } else {
    userRecord = await auth.createUser({
      ...(preferredUid ? { uid: preferredUid } : {}),
      email,
      password,
      displayName,
      disabled,
    });
  }
  return userRecord;
}

async function clearCollectionExcept(collectionName, keepIds = new Set()) {
  const snap = await db.collection(collectionName).get();
  let deleted = 0;
  for (const doc of snap.docs) {
    if (!keepIds.has(doc.id)) {
      await doc.ref.delete();
      deleted++;
    }
  }
  console.log(`[Sanitize] ${collectionName}: deleted ${deleted} stale/test docs (kept ${keepIds.size} target IDs).`);
}

async function run() {
  console.log('=== Starting EventPool Firebase Sanitization & Controlled Seeding ===\n');

  // 1. Ensure Controlled Account Set in Firebase Auth
  const adminUser = await upsertAuthUser({
    email: 'admin@admin.com',
    password: 'Admin123!',
    displayName: 'System Administrator',
    disabled: false,
    preferredUid: 'pmzzDZPXoPPJy12DFxXOdc932Bv1',
  });

  const pekomUser = await upsertAuthUser({
    email: 'pekom.club@um.edu.my',
    password: 'Pekom123!',
    displayName: 'Persatuan Komputer Universiti Malaya',
    disabled: false,
    preferredUid: 'v1ZZnLEfIQP2zFikAMGHOSHlh9d2',
  });

  const roboUser = await upsertAuthUser({
    email: 'hafiz@um.edu.my',
    password: 'Robo123!',
    displayName: 'Robotics Engineering Community',
    disabled: false,
    preferredUid: 'trbwOTe5MxaY9Exsb0ojhi2Xbb13',
  });

  const inactiveUser = await upsertAuthUser({
    email: 'inactive.club@um.edu.my',
    password: 'Inactive123!',
    displayName: 'Drama & Theater Society',
    disabled: true,
  });

  const keepUids = new Set([adminUser.uid, pekomUser.uid, roboUser.uid, inactiveUser.uid]);

  // Remove any leftover/polluted Auth accounts (e.g. club_a_1795*@eventpool.test, abc@example.com)
  const listResult = await auth.listUsers(1000);
  let deletedAuthCount = 0;
  for (const u of listResult.users) {
    if (!keepUids.has(u.uid)) {
      await auth.deleteUser(u.uid);
      deletedAuthCount++;
      console.log(`  Deleted leftover Auth user: ${u.email || u.uid}`);
    }
  }
  console.log(`[Sanitize] Auth Users: kept 4 controlled accounts, deleted ${deletedAuthCount} leftover users.\n`);

  const now = new Date().toISOString();

  // 2. Seed Admins Collection
  const keepAdmins = new Set([adminUser.uid]);
  await clearCollectionExcept('Admins', keepAdmins);
  await db.collection('Admins').doc(adminUser.uid).set({
    adminId: adminUser.uid,
    email: 'admin@admin.com',
    userName: 'System Administrator',
    adminName: 'System Administrator',
    isActive: true,
    createdAt: now,
  });

  // 3. Seed Clubs Collection (3 controlled clubs: Owner, Borrower, Inactive)
  const targetClubs = [
    {
      clubId: 'club-pekom',
      clubName: 'Persatuan Komputer Universiti Malaya',
      description: 'UM Computer Science Society — lends AV, projectors, and presentation gear.',
      contactEmail: 'pekom.club@um.edu.my',
      authUId: pekomUser.uid,
      authUid: pekomUser.uid,
      picContactNum: '012-3456789',
      isActive: true,
      createdAt: now,
    },
    {
      clubId: 'club-robotics',
      clubName: 'Robotics Engineering Community',
      description: 'UM Student Robotics & Maker Club — builds and shares workshop tools and hardware.',
      contactEmail: 'hafiz@um.edu.my',
      authUId: roboUser.uid,
      authUid: roboUser.uid,
      picContactNum: '013-9876543',
      isActive: true,
      createdAt: now,
    },
    {
      clubId: 'club-inactive',
      clubName: 'Drama & Theater Society',
      description: 'Deactivated test club account for access-control and login verification.',
      contactEmail: 'inactive.club@um.edu.my',
      authUId: inactiveUser.uid,
      authUid: inactiveUser.uid,
      picContactNum: '014-5550199',
      isActive: false,
      createdAt: now,
    },
  ];
  await clearCollectionExcept('Clubs', new Set(targetClubs.map((c) => c.clubId)));
  for (const club of targetClubs) {
    await db.collection('Clubs').doc(club.clubId).set(club);
  }

  // 4. Seed Standardized 5-Resource Catalogue
  const targetResources = [
    {
      resourceId: 'res-pekom-projector',
      clubId: 'club-pekom',
      itemName: 'HD Multimedia Projector',
      category: 'Electronics',
      description: 'Epson 1080p wireless projector with HDMI/VGA cables and carry case.',
      totalQuantity: 5,
      availableQuantity: 4,
      reservedQuantity: 0,
      borrowedQuantity: 1,
      condition: 'Excellent',
      location: 'FSKTM Block A, Room 204',
      remarks: 'Handle lens with care; includes remote control.',
      estimatedUnitCost: 1800,
      estimatedUnitWeight: 3.2,
      status: 'Available',
      imageURL: null,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      resourceId: 'res-pekom-speaker',
      clubId: 'club-pekom',
      itemName: 'Portable PA Sound System',
      category: 'Audio Equipment',
      description: '200W portable speaker with dual wireless handheld microphones.',
      totalQuantity: 4,
      availableQuantity: 4,
      reservedQuantity: 0,
      borrowedQuantity: 0,
      condition: 'Good',
      location: 'FSKTM Student Lounge',
      remarks: 'Charge battery fully before outdoor events.',
      estimatedUnitCost: 950,
      estimatedUnitWeight: 8.5,
      status: 'Available',
      imageURL: null,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      resourceId: 'res-pekom-easels',
      clubId: 'club-pekom',
      itemName: 'Display Easels Set',
      category: 'Decorations',
      description: 'Adjustable aluminum A-frame exhibition easels for A1/A2 poster boards.',
      totalQuantity: 6,
      availableQuantity: 6,
      reservedQuantity: 0,
      borrowedQuantity: 0,
      condition: 'Good',
      location: 'FSKTM Storeroom B',
      remarks: 'Folds flat for transport.',
      estimatedUnitCost: 120,
      estimatedUnitWeight: 2.0,
      status: 'Available',
      imageURL: null,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      resourceId: 'res-robo-soldering',
      clubId: 'club-robotics',
      itemName: 'Soldering Station Kit',
      category: 'Electronics',
      description: 'Temperature-controlled soldering station with solder wire and safety stand.',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      borrowedQuantity: 0,
      condition: 'Excellent',
      location: 'Engineering Makerspace Lab 3',
      remarks: 'Supervised workshop use recommended.',
      estimatedUnitCost: 320,
      estimatedUnitWeight: 1.5,
      status: 'Available',
      imageURL: null,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      resourceId: 'res-robo-banners',
      clubId: 'club-robotics',
      itemName: 'Pop-up Banner Stand',
      category: 'Decorations',
      description: 'Retractable 85cm x 200cm aluminum roll-up banner stands.',
      totalQuantity: 5,
      availableQuantity: 5,
      reservedQuantity: 0,
      borrowedQuantity: 0,
      condition: 'Good',
      location: 'Engineering Makerspace Lab 3',
      remarks: 'Stand hardware only; attach your club banner print.',
      estimatedUnitCost: 180,
      estimatedUnitWeight: 2.5,
      status: 'Available',
      imageURL: null,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
  await clearCollectionExcept('Resources', new Set(targetResources.map((r) => r.resourceId)));
  for (const res of targetResources) {
    await db.collection('Resources').doc(res.resourceId).set(res);
  }

  // 5. Seed Controlled Events
  const targetEvents = [
    {
      eventId: 'evt-pekom-01',
      clubId: 'club-pekom',
      eventName: 'UM Hackathon 2026',
      eventDate: toISODate(14),
      purpose: 'Annual 24-hour student coding competition',
      description: 'Main hall presentation and judging event.',
      createdAt: now,
    },
    {
      eventId: 'evt-robo-01',
      clubId: 'club-robotics',
      eventName: 'National Robotics Showcase',
      eventDate: toISODate(10),
      purpose: 'Autonomous robot demonstration and STEM outreach',
      description: 'Requires projector and sound equipment for main stage.',
      createdAt: now,
    },
  ];
  await clearCollectionExcept('Events', new Set(targetEvents.map((e) => e.eventId)));
  for (const evt of targetEvents) {
    await db.collection('Events').doc(evt.eventId).set(evt);
  }

  // 6. Seed Controlled BorrowingRequests (1 Overdue Borrowed + 1 Pending)
  const targetRequests = [
    {
      requestId: 'req-overdue-01',
      resourceId: 'res-pekom-projector',
      ownerClubId: 'club-pekom',
      borrowerClubId: 'club-robotics',
      eventId: 'evt-robo-01',
      eventName: 'National Robotics Showcase',
      quantity: 1,
      purpose: 'Stage presentation during robotics workshop',
      wouldHavePurchased: true,
      remarks: 'Seeded overdue record for QA verification (C8).',
      pickupDate: toISODate(-12),
      expectedReturnDate: toISODate(-5),
      status: 'Borrowed',
      returnCondition: null,
      actualReturnDate: null,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
    {
      requestId: 'req-pending-01',
      resourceId: 'res-pekom-speaker',
      ownerClubId: 'club-pekom',
      borrowerClubId: 'club-robotics',
      eventId: 'evt-robo-01',
      eventName: 'National Robotics Showcase',
      quantity: 1,
      purpose: 'Outdoor announcements at booth area',
      wouldHavePurchased: true,
      remarks: 'Will return promptly after closing ceremony.',
      pickupDate: toISODate(7),
      expectedReturnDate: toISODate(11),
      status: 'Pending',
      returnCondition: null,
      actualReturnDate: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  await clearCollectionExcept('BorrowingRequests', new Set(targetRequests.map((r) => r.requestId)));
  for (const req of targetRequests) {
    await db.collection('BorrowingRequests').doc(req.requestId).set(req);
  }

  console.log('\n=== Sanitization & Controlled Seeding Complete! ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('Sanitization failed:', err);
  process.exit(1);
});
