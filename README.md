# EventPool

A resource-sharing platform for UM student clubs to list, discover and borrow event equipment from each other.
Built for WIX2002 (Project Management).

**Deployed prototype:** _to be added by M7/M8 (Week 8)_

## Getting started

### Frontend (React + Vite)

```bash
npm ci
npm run dev      # start the frontend dev server, open the URL Vite prints
npm run build    # production build
```

### Backend (Express + Firebase Admin SDK)

```bash
cd backend
npm install
npm run dev          # start backend server on http://localhost:5000/api
npm run test:verify  # execute BE-01 through BE-05 automated test suite
```

## Project structure

| Path | Purpose |
| --- | --- |
| `backend/` | Express.js REST API service, Firebase Admin SDK integration, authentication middlewares, controllers, and test suite |
| `src/components/` | Shared UI components (Layout, Navbar, Button, Card, FormField, StatusMessage, PageHeader) |
| `src/styles/theme.css` | Design tokens (colours, spacing). Update here once `docs/design-system.md` is final |
| `src/pages/` | Page components. `borrower/` = borrower-facing (M5), owner pages = M6 |
| `docs/` | Requirements, test plan, design system, API contracts, `BUGS.md` |
| `evidence/` | Project evidence for the report: `screenshots/`, `interviews/`, `meetings/`, `finance/`, `pm-board/`, backend verification logs |

## Jira Tasks Assigned & Completed (M7 — Backend Lead)

**Developer:** Jasmine Chin (M7 — Backend / Database Developer Lead)  
**Branch:** `JasmineJY_M7_Sprint4`  
**API Specification:** API Contract Specification v1.1  

| Jira Key | Task Description | Scope | Status | Deliverables & Implementation Highlights |
| :--- | :--- | :---: | :---: | :--- |
| **EPM-52** | **BE-01 Authentication and role mapping** | BE-01 | **Completed** | • `authenticate` middleware validating Firebase Bearer ID tokens via Firebase Admin SDK.<br>• Automatic role mapping from Firestore `Admins` and `Clubs` collections.<br>• Account deactivation protection (`403 ACCOUNT_DISABLED`).<br>• Role guards: `requireAdmin`, `requireClub`.<br>• `GET /api/auth/profile` returning typed profile (`admin` or `club`). |
| **EPM-53** | **BE-02 Resource CRUD APIs** | BE-02 | **Completed** | • `POST /api/resources` with positive quantity validation and status initialization.<br>• Dynamic status calculation: `Available`, `Reserved`, `Borrowed`, `Unavailable`.<br>• `GET /api/resources` with multi-filter (`category`, `status`, `clubId`, `location`) and pagination, excluding archived resources and inactive clubs.<br>• `GET /api/resources/search` case-insensitive substring search on `itemName` and `description`.<br>• `GET /api/resources/:resourceId` details.<br>• `PATCH /api/resources/:resourceId` with invariant check `totalQuantity >= reservedQuantity + borrowedQuantity` (`409 QUANTITY_CONFLICT`).<br>• `PATCH /api/resources/:resourceId/archive` soft-delete with active borrowing lock check (`409 RESOURCE_HAS_ACTIVE_BORROWINGS`).<br>• `PATCH /api/resources/:resourceId/availability` toggle. |
| **EPM-54** | **BE-03 Image upload to Firebase Storage** | BE-03 | **Completed** | • `POST /api/resources/:resourceId/image` multipart upload via Multer `memoryStorage`.<br>• Strict media type validation (`image/jpeg`, `image/png` $\rightarrow$ `415 UNSUPPORTED_MEDIA_TYPE`).<br>• File size limit $\le$ 5MB (`413 FILE_TOO_LARGE`).<br>• Cloud & local dual-mode: uploads to Firebase Storage bucket when configured, with automatic fallback to local storage (`backend/uploads/resources/`) for Firebase free (Spark) plans.<br>• `GET /api/resources/:resourceId/image` and `DELETE /api/resources/:resourceId/image`. |
| **EPM-55** | **BE-04 Club and event endpoints and permission tests** | BE-04 | **Completed** | • `GET /api/clubs` and `GET /api/clubs/:clubId` public directory endpoints.<br>• `PATCH /api/clubs/:clubId` with ownership enforcement (own club only, admin can edit any) and automatic email synchronization to Firebase Auth.<br>• `POST /api/events` creating event scoped to authenticated club (`req.user.clubId`).<br>• `GET /api/events` (clubs view own events; admins view all with optional `clubId`/`eventDate` filters). |
| **EPM-56** | **BE-05 Implement Admin Account and Dashboard APIs** | BE-05 | **Completed** | • `GET /api/admin/profile` fetching admin profile details from Firestore `Admins`.<br>• `POST /api/admin/clubs` atomic creation of Firebase Auth user + Firestore `Clubs` document with rollback on failure and duplicate email check (`409 EMAIL_ALREADY_EXISTS`).<br>• `PATCH /api/admin/clubs/:clubId/deactivate` disabling user in Firebase Auth and setting `isActive: false` in Firestore.<br>• `GET /api/admin/dashboard` computing aggregate metrics (`totalClubs`, `activeClubs`, `totalResources`, `totalBorrowingRequests`, `pendingRequests`, `completedRequests`). |

### Automated Verification & Evidence

All 5 modules are covered by an automated test suite ([backend/tests/sprint1_verification.js](file:///c:/Documents/Jasmine/Y2S1/ProjMag/Assignment/backend/tests/sprint1_verification.js)) verifying authentication, role boundaries, cross-club isolation, conflict responses, and image uploads.

* **Test Result:** **41 / 41 PASSED (0 failures)**
* **Evidence Log:** [evidence/sprint1_backend_verification.txt](file:///c:/Documents/Jasmine/Y2S1/ProjMag/Assignment/evidence/sprint1_backend_verification.txt)

## Routes

| Route | Page |
| --- | --- |
| `/` | Home |
| `/login` | Log in |
| `/marketplace` | Resource marketplace (search, filters) |
| `/marketplace/:resourceId` | Resource details |
| `/marketplace/:resourceId/request` | Borrow request form |
| `/requests` | My requests |
| `/dashboard`, `/club/:clubId`, `/dashboard/*`, `/sustainability` | Owner pages (M6) |

## Workflow

- Every task lives on the Jira board. Done = built, tested by M9, screenshot saved to `evidence/`.
- Never push to `main`. Branch from `main` (`feat/<short-name>`, `fix/<BUG-id>-<short-name>`), open a pull request, get at least one review, then merge.
- Reference the Jira key (e.g. `EPM-24`) or `BUGS.md` ID in PR titles.
- Frontend work follows the Figma handoff from M3/M4 and the API contracts in `docs/api-contracts.md`.
