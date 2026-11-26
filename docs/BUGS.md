# BUGS — EventPool Defect Log

**Owner:** WEI XIN — QA Engineer (M9)
**Sprint:** Sprint 2 — Complete Prototype Integration
**Build reviewed:** `main`, 22 November 2026
**Last updated:** 22 November 2026

This document records defects found in the current prototype and distinguishes
confirmed fixes from issues that remain open.

## Summary

| Severity | Open | Fixed / Verified |
| --- | ---: | ---: |
| Critical | 1 | 1 |
| Major | 4 | 0 |
| Minor | 3 | 3 |
| **Total** | **8** | **4** |

## Status guide

- **Open** — reproduced or confirmed from source and not yet fixed.
- **In Progress** — assigned and under implementation.
- **Fixed** — code was changed but is not yet accepted by M9.
- **Closed** — M9 re-ran the original case and relevant regression cases.

## Defect register

| ID | Title | Module | Severity | Status | Owner |
| --- | --- | --- | --- | --- | --- |
| BUG-001 | Frontend does not persist full borrowing lifecycle actions | M3/M4/M8 | **Critical** | Open | M5/M6/M8 |
| BUG-002 | Landing page and impact data use demo fixtures | M1/M6 | **Major** | Open | M5/M6 |
| BUG-003 | Signed-out Marketplace is restricted by route guard | M1 | **Major** | Open | M1/M5 |
| BUG-004 | Live Firebase contains test and duplicate records | Data | **Major** | Open | M7/M9 |
| BUG-005 | My Club cannot reliably resolve a freshly signed-in real club | M4 | **Major** | Open | M6/M7 |
| BUG-006 | Local borrowing actions can differ from Firestore | M3/M4/M8 | **Major** | Open | M5/M6/M8 |
| BUG-007 | Demo club fixture records contain plaintext passwords | Data | Minor | Open | M5/M7 |
| BUG-008 | Borrow-form validation can remain above the user's submit position | M3 | Minor | Open | M5 |
| BUG-009 | Frontend/backend proxy port mismatch was resolved | Infrastructure | Minor | **Closed** | M5 |
| BUG-010 | API exports missing in `src/services/api.ts` were restored | Infrastructure | Minor | **Closed** | M5 |
| BUG-011 | Borrowing API routes are implemented in the backend | M8 | **Critical** | **Fixed** | M8 |
| BUG-012 | Firebase web API key now has no hard-coded frontend fallback | Infrastructure | Minor | **Closed** | M5 |

---

## BUG-001 — Frontend does not persist the full borrowing lifecycle

- **Module:** M3 Borrowing Request, M4 My Club, M8 Lifecycle
- **Severity:** Critical
- **Status:** Open
- **Found:** 22 November 2026
- **Assigned to:** M5, M6 and M8

**Actual implementation**

The backend defines the complete lifecycle:

`Pending → Approved → Borrowed → Return Pending → Completed`

It also provides route handlers for create, approve, reject, mark borrowed,
submit return and complete return in
`backend/src/routes/borrowingRequestRoutes.js`.

The frontend still contains fixture-only implementations in
`src/context/AppContext.tsx` for:

- submit
- approve
- reject
- cancel
- mark picked up
- mark returned
- verify/complete return

These actions mutate React/local persisted state only. They do not call the
corresponding borrowing API endpoints.

**Impact**

The UI can show a changed status and stock count, but a refresh or another
client can show the original Firestore state. This prevents a trustworthy
borrow–return workflow.

**Required fix**

Replace the local mutation actions with API calls that:

1. Create and refresh real requests.
2. Persist approve/reject/pickup/return/complete transitions.
3. Reload request and resource data after every transition.
4. Display server errors instead of success-shaped local updates.

**Verification required**

M9 must run the `2→1→1→2` lifecycle and verify the same request/status in
two browser sessions and after refresh.

---

## BUG-002 — Landing page and impact metrics use demo fixtures

- **Module:** M1 Marketplace, M6 Sustainability
- **Severity:** Major
- **Status:** Open
- **Found:** 22 November 2026
- **Assigned to:** M5 and M6

**Actual result**

The landing page uses `INITIAL_RESOURCES` and fixed impact values. The signed-in
Marketplace reads live Firestore records. The two surfaces therefore advertise
different catalogues and sustainability figures.

**Evidence**

- Landing page: four advertised resource cards and fixed “Our Impact” values.
- Marketplace: live database records, including test-generated records.
- `src/pages/HomePage.tsx` uses fixture-backed state.
- `src/services/resources.ts` uses `/api/resources`.

**Required fix**

Either derive all landing-page and impact values from live records or clearly
label every fixture as demo/sample data. The two catalogues must not appear
to represent the same system.

---

## BUG-003 — Marketplace requires sign-in

- **Module:** M1 Resource Marketplace
- **Severity:** Major
- **Status:** Open
- **Found:** 20 November 2026
- **Assigned to:** M1 and M5

**Actual result**

`marketplace` and `resource_detail` remain authenticated views in
`src/context/viewAccess.ts`. Read-only resource routes are also behind
`authenticate` in the backend.

This prevents an anonymous visitor from browsing the catalogue and conflicts
with public browsing requirements unless the product intentionally defines
marketplace browsing as members-only.

**Required decision/fix**

- Option A: open read-only routes and browsing views to anonymous users.
- Option B: document marketplace browsing as authenticated and update the
  requirements to match.

---

## BUG-004 — Live Firebase contains test and duplicate records

- **Module:** Data and UAT environment
- **Severity:** Major
- **Status:** Open
- **Found:** 22 November 2026
- **Assigned to:** M7 and M9

**Actual result**

The Marketplace currently shows records named
`TEST_BORROWING_<timestamp>_RESOURCE`, plus duplicate club names.

`backend/tests/borrowing_request_test.js` creates two clubs, a test event,
test resources and borrowing records without a cleanup step.

**Required fix**

Use a disposable Firebase test project or remove/quarantine test records from
the demonstration project before UAT. Retain one controlled catalogue and
one realistic club account set.

---

## BUG-005 — Freshly signed-in club account may not resolve to My Club data

- **Module:** M4 Club Profiles
- **Severity:** Major
- **Status:** Open
- **Found:** 20 November 2026
- **Assigned to:** M6 and M7

**Actual result**

My Club currently resolves the club primarily through the fixture-backed club
map and cached remote club data. A fresh live login does not have a guaranteed
club cache entry before My Club renders.

**Required fix**

On login or My Club mount, fetch `GET /api/clubs/:clubId` for the authenticated
`currentUser.clubId`, cache it, and do not fall back to `club-pekom`.

---

## BUG-006 — My Club and borrowing UI are not fully API-backed

- **Module:** M4/M5/M6/M8
- **Severity:** Major
- **Status:** Open
- **Found:** 22 November 2026
- **Assigned to:** M5, M6 and M8

**Actual result**

Live Marketplace and resource detail data can load through the API, while
My Club and several borrowing lifecycle actions continue to use
`seedData.ts`, React state and local persisted state.

**Required fix**

Create a clear API-backed data path for:

- club profile
- incoming/outgoing requests
- request details
- lifecycle transitions
- resource quantities
- request history

---

## BUG-007 — Demo fixture clubs contain plaintext passwords

- **Module:** Data and fixtures
- **Severity:** Minor
- **Status:** Open
- **Found:** 20 November 2026
- **Assigned to:** M5 and M7

**Actual result**

Club entries in `src/data/seedData.ts` contain a `password` field.
Authentication is implemented through Firebase and does not use this field.

**Required fix**

Remove password fields and place demo credentials only in a restricted
test-account list or environment, not in source-controlled seed data.

---

## BUG-008 — Borrow-form validation alert is disconnected from submit position

- **Module:** M3 Borrowing form
- **Severity:** Minor
- **Status:** Open
- **Found:** 20 November 2026
- **Assigned to:** M5

**Actual result**

The validation message appears near the top of the form, while Submit is at
the bottom. The user can receive no visible feedback if the page does not
scroll or focus the first invalid field.

**Required fix**

Focus and scroll to the first invalid field or move a clear inline alert next
to the Submit action.

---

## Closed/Fixed defects

### BUG-009 — Frontend proxy port mismatch

- **Status:** Closed
- `vite.config.ts` now proxies `/api` and `/uploads` to port `5000`.
- Verified by backend health and proxy responses on 22 November 2026.

### BUG-010 — Missing API exports

- **Status:** Closed
- `ApiError`, `apiRequest`, `loginWithFirebaseAuth` and
  `setUnauthorizedHandler` are exported from `src/services/api.ts`.
- `useCallback` was restored in `AppContext.tsx`.
- Verified by `npm run lint` and `npm run build`.

### BUG-011 — Borrowing backend routes

- **Status:** Fixed, not yet end-to-end closed
- The backend now implements create, approve, reject, list, return, complete
  and mark-borrowed operations.
- M9 must verify all actions through the UI and Firestore before closure.

### BUG-012 — Frontend Firebase key fallback

- **Status:** Closed
- `src/services/api.ts` reads `VITE_FIREBASE_WEB_API_KEY` and fails clearly
  when it is missing instead of using a frontend fallback value.
- The key-bearing `.env.local` and `backend/.env.example` files should still
  be checked and replaced with placeholders before sharing the repository.

## Coverage note

Verified on 22 November 2026:

- Frontend starts and responds on a Vite port.
- Backend `/api/health` returns `200`.
- Vite proxies `/api` to the backend.
- TypeScript lint passes.
- Production build passes.
- Borrowing routes and a lifecycle test suite exist in the backend.
- Live data currently contains test records and duplicate clubs.
- End-to-end UI persistence for approval, pickup, return and verification is
  not yet verified.

## New defect template

```markdown
### BUG-000 — <problem title>

- **Module:** <module>
- **Severity:** Critical / Major / Minor
- **Found:** <date>
- **Assigned to:** <member>
- **Status:** Open

**Preconditions**
<required account, data and environment>

**Steps to reproduce**
1.
2.
3.

**Expected result**
<requirement or correct behaviour>

**Actual result**
<observed behaviour>

**Evidence**
<screenshot, API response or test output>

**Required fix**
<specific action>
```
