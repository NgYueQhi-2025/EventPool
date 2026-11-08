# Design Review — Testability (EPM-24)

**Jira:** EPM-24 · **Gantt:** 4.1  
**Reviewer:** WEI XIN — QA Engineer (M9)  
**Design owner:** Jasmine Chin — Backend/Database Developer (Lead), EPM-16 / EPM-17 / EPM-18  
**Artifact reviewed:** API Contract Specification v1.1 and Firestore schema (Google Doc, shared 5 Nov)  
**Date:** 8 November 2026  
**Status:** Review complete — 4 issues raised

---

## Why this review exists

A system can be functionally complete and still be untestable. If the data model gives no way to distinguish one state from another, or no way to create the situation that needs testing, then no amount of test writing helps. This review checks whether EventPool can actually be verified before execution starts in week 7.

The outcome is not a score. It is a short list of fixable items, split by whether they block testing or merely slow it down. Confirmed defects are copied into [`BUGS.md`](BUGS.md) as `BUG-nn` entries.

---

## Summary

|                  |                                                                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checks performed | 10                                                                                                                                                                                                                                                             |
| Passed           | 6                                                                                                                                                                                                                                                              |
| Issues raised    | 4 (1 blocks week 7 testing)                                                                                                                                                                                                                                    |
| Verdict          | **The design is testable in principle.** Inventory handling, state transitions and error codes are specified well enough to write precise assertions against. The gaps are in the data model's consistency and in the test environment, not in the core logic. |

---

## What passed

These are the things that make precise testing possible. They are recorded here so the team knows what must not be broken by later changes.

| # | Check                                                                                                                                            | Evidence                                                                                                                                                                 |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 | Inventory is stored as four integer fields with an explicit invariant, so a wrong balance can be caught by assertion rather than by eye          | `totalQuantity = availableQuantity + reservedQuantity + borrowedQuantity` (schema note and §10.2)                                                                        |
| 2 | Concurrency is addressed by design, not left to chance                                                                                           | "Update inventory atomically using a Firestore transaction" in §5.4 approve, §5.6 cancel, §5.7 borrow; §10.2 requires transactions where concurrent updates are possible |
| 3 | Every request carries `createdAt` and `updatedAt`, so ordering can be asserted in concurrency tests                                              | `BorrowingRequests` schema                                                                                                                                               |
| 4 | Status is a closed set of seven values and every legal transition is enumerated with the responsible account                                     | §10.3; illegal transitions must return `409 INVALID_STATUS_TRANSITION`                                                                                                   |
| 5 | Error responses are structured and the error codes are genuinely distinguishable — "not enough stock" and "resource disabled" are separate codes | `409 INSUFFICIENT_QUANTITY` and `409 RESOURCE_NOT_AVAILABLE` in §5.1, §5.4                                                                                               |
| 6 | Withdrawal is a soft delete, so historical records stay resolvable and dashboard totals do not silently shift                                    | "Archived resources are retained in Firestore rather than permanently deleted" (§12)                                                                                     |

Two further points worth noting because they show the design was thought through: `isOverdue` is computed rather than stored (§10.7 gives the exact predicate), and return quantities obey `quantity = usable + damaged + missing`, which means a test can assert that damaged items never return to available stock.

---

## Issues raised

### DR-01 — `returnCondition` is declared Required, but is null when a request is created

**Severity:** Major · **Blocks:** writing the create-request test case

The `BorrowingRequests` schema marks `returnCondition` as `Required`. The API, however, returns `"returnCondition": null` for a newly created request and only sets a value when the owner completes the return (§5.9).

As written, two readers of this document would build different things: one would reject a create-request call that omits `returnCondition`, the other would not. A tester cannot tell whether a missing value is correct behaviour or a defect.

**Recommendation:** mark the field `Optional` in the schema and state that it becomes mandatory at §5.9. This matches how `actualReturnDate`, `returnVerifiedAt` and the return quantities are already handled — they are all `Optional` and populated later.

---

### DR-02 — The resource status has two conflicting definitions

**Severity:** Major · **Blocks:** the availability badge test

The `Resources` schema notes `Possible status type : Available, Unavailable` — two values. §10.4 defines four: `Available`, `Reserved`, `Borrowed`, `Unavailable`. §10.4 also adds derivation rules (for example, "use Reserved when reserved units exist; otherwise use Borrowed"), which the schema note does not mention.

A badge assertion needs exactly one source of truth. With two definitions in the same document, a mismatched badge cannot be classified as a defect — it may simply be the other definition being implemented.

**Recommendation:** delete the two-value note from the schema and keep §10.4 as the only definition. If the schema note was meant to describe the stored field while §10.4 describes a computed value, say so explicitly and give the computation rule.

---

### DR-03 — "The owner is notified" has no design behind it

**Severity:** Major · **Blocks:** one requirement from being testable at all

The project requirements state that the resource owner is notified when a request is submitted. The API contract contains no notification concept — no endpoint, no field, no event, no mention of email or in-app messages.

This is currently a requirement that nobody can verify. At week 11 it becomes a UAT question with no correct answer, and in the final report it becomes either a silent omission or an untested claim.

**Recommendation:** decide explicitly, and record the decision in this contract. Either (a) implement in-app notification with a retrievable list, which is testable; or (b) use email, which is testable only by checking the receiving inbox; or (c) drop the requirement and remove it from the feature list. Option (c) is legitimate — an undocumented requirement is worse than a missing one.

---

### DR-04 — No test environment and no way to create test data

**Severity:** Critical · **Blocks:** all execution from week 7

The contract names one Firestore database and one Firebase project. There is no separate test instance, no seed script, and no stated procedure for creating the two-club, five-resource state that most test cases assume.

Without these, every test run starts by hand-building data through the UI, which is slow, unrepeatable, and pollutes whatever data the team wants to show in the demo. The concurrency cases in week 9 — two clubs requesting the same last unit — cannot be reconstructed reliably at all.

**Recommendation:** two concrete asks, in order of preference.

1. Create a second Firebase project for testing, so demo data is never touched.
2. Failing that, agree a written reset procedure: which collections are cleared, in what order, and who runs it before each test round.

Either way, a seed script that creates two clubs and five resources in known states turns a 20-minute manual setup into one command. This is worth asking for now, while the schema is still being finalised.

---

## Observations (not raised as issues)

- **Pickup delay is not tracked.** §10.7 notes that `isPickupOverdue` could be calculated from `pickupDate` but does not define it. If nothing in the requirements asks for it, this is fine — recording it here so the gap is a decision rather than an oversight.
- **PATCH semantics with required fields.** §12 states that PATCH updates only supplied fields, while the schema marks many fields Required. This is consistent for update endpoints that re-validate the merged document, but it is worth confirming, because a test for "partial update leaves other fields intact" needs a known expected result.

---

## Actions

| # | Action                                                           | Owner        | By when               |
| - | ---------------------------------------------------------------- | ------------ | --------------------- |
| 1 | DR-01: change `returnCondition` to Optional                      | Jasmine Chin | Before week 7         |
| 2 | DR-02: remove the duplicate status definition, keep §10.4        | Jasmine Chin | Before week 7         |
| 3 | DR-03: decide notification in or out, and record it              | Ng Yue Qhi   | Before week 7         |
| 4 | DR-04: create a test Firebase project or agree a reset procedure | Ng Yue Qhi   | Before week 7         |
| 5 | Copy DR-01 to DR-04 into `BUGS.md` once confirmed                | WEI XIN      | After the team agrees |

---

## Review log

| Date  | Action                                                           | Outcome                                      |
| ----- | ---------------------------------------------------------------- | -------------------------------------------- |
| 5 Nov | Jasmine Chin shares schema and API contract v1.1 for team review | Received                                     |
| 8 Nov | Reviewed all 10 testability checks against the document          | 6 passed, 4 issues raised                    |
| 8 Nov | Findings compiled into this document                             | Ready to send to Jasmine Chin and Ng Yue Qhi |
