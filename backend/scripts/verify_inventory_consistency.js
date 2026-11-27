import { db } from '../src/config/firebase.js';
import { calculateResourceStatus } from '../src/utils/resourceStatus.js';

const computeResourceStatus = (resource) => {
  try {
    return calculateResourceStatus(resource);
  } catch {
    return 'Unavailable';
  }
};

async function verifyInventory() {
  console.log('=== EventPool Firestore Inventory & Reservation Consistency Audit ===\n');

  const [resourcesSnap, requestsSnap] = await Promise.all([
    db.collection('Resources').get(),
    db.collection('BorrowingRequests').get(),
  ]);

  const reservedByResource = new Map();
  const borrowedByResource = new Map();

  requestsSnap.forEach((doc) => {
    const r = doc.data();
    const qty = Number(r.quantity) || 0;
    if (r.status === 'Approved') {
      reservedByResource.set(r.resourceId, (reservedByResource.get(r.resourceId) || 0) + qty);
    } else if (r.status === 'Borrowed' || r.status === 'Return Pending') {
      borrowedByResource.set(r.resourceId, (borrowedByResource.get(r.resourceId) || 0) + qty);
    }
  });

  let checked = 0;
  let errors = 0;

  for (const doc of resourcesSnap.docs) {
    checked++;
    const res = doc.data();
    const id = res.resourceId || doc.id;
    const total = Number(res.totalQuantity) || 0;
    const avail = Number(res.availableQuantity) || 0;
    const reserved = Number(res.reservedQuantity) || 0;
    const borrowed = Number(res.borrowedQuantity) || 0;

    const issues = [];

    if (total < 0 || avail < 0 || reserved < 0 || borrowed < 0) {
      issues.push(`Negative quantity detected (total=${total}, avail=${avail}, reserved=${reserved}, borrowed=${borrowed})`);
    }
    if (total !== avail + reserved + borrowed) {
      issues.push(`Stock invariant mismatch: ${total} !== ${avail} + ${reserved} + ${borrowed}`);
    }

    const expectedReserved = reservedByResource.get(id) || 0;
    if (reserved !== expectedReserved) {
      issues.push(`Reserved mismatch vs Approved requests: stored=${reserved}, requests=${expectedReserved}`);
    }

    const expectedBorrowed = borrowedByResource.get(id) || 0;
    if (borrowed !== expectedBorrowed) {
      issues.push(`Borrowed mismatch vs Borrowed/ReturnPending requests: stored=${borrowed}, requests=${expectedBorrowed}`);
    }

    const expectedStatus = computeResourceStatus(res);
    if (res.status && res.status !== expectedStatus) {
      issues.push(`Status mismatch: stored='${res.status}', computed='${expectedStatus}'`);
    }

    if (issues.length > 0) {
      errors += issues.length;
      console.error(`  [FAIL] ${id} (${res.itemName}):`);
      issues.forEach((msg) => console.error(`         - ${msg}`));
    } else {
      console.log(
        `  [PASS] ${id} (${res.itemName}) -> total=${total}, avail=${avail}, reserved=${reserved}, borrowed=${borrowed}, status=${expectedStatus}`
      );
    }
  }

  console.log('\n============================================================');
  console.log(`INVENTORY AUDIT: ${checked} resources checked, ${errors} discrepancies found`);
  console.log('============================================================');

  process.exit(errors > 0 ? 1 : 0);
}

verifyInventory().catch((err) => {
  console.error('Inventory audit failed:', err);
  process.exit(1);
});
