# EventPool

A resource-sharing platform for UM student clubs to list, discover and borrow event equipment from each other.
Built for WIX2002 (Project Management).

**Deployed prototype:** https://event-pool.vercel.app/

## Getting started

### Prerequisites & Installation

```bash
# Install frontend & root dependencies
npm install --legacy-peer-deps

# Install backend dependencies
cd backend && npm install && cd ..
```

### Running Locally (Frontend + Backend)

Run the backend and frontend in separate terminals:

* **Terminal 1 — Backend API (Express + Firebase Admin SDK):**
  ```bash
  npm run dev:backend    # Runs Express API on http://localhost:5000/api
  ```

* **Terminal 2 — Frontend Client (React 19 + Vite + TypeScript):**
  ```bash
  npm run dev            # Runs Vite on http://localhost:3000 (proxies /api to :5000)
  ```

### Build, Database Sanitization & Automated Tests

```bash
npm run db:sanitize --prefix backend  # Reset Firestore/Auth to clean controlled UAT accounts & 5-item catalogue
npm run test:backend                  # Execute BE-01 - BE-05 verification suite (self-cleaning)
npm run test:borrowing --prefix backend # Execute borrowing lifecycle & public marketplace suite (self-cleaning)
npm run lint                          # TypeScript type check (tsc --noEmit)
npm run build                         # Production frontend build
```

### Controlled UAT / QA Login Accounts

| Role | Email | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@admin.com` | `Admin123!` | Platform admin, club creation, dashboard metrics |
| **Club 1 (Owner)** | `pekom.club@um.edu.my` | `Pekom123!` | Persatuan Komputer UM — owns projectors, speakers, easels |
| **Club 2 (Borrower)** | `hafiz@um.edu.my` | `Robo123!` | Robotics Engineering Community — borrower & soldering kit owner |
| **Club 3 (Inactive)** | `inactive.club@um.edu.my` | `Inactive123!` | Deactivated account verification (`403 ACCOUNT_DISABLED`) |

## Project structure

| Path | Purpose |
| --- | --- |
| `backend/` | Express.js REST API service, Firebase Admin SDK integration, authentication middlewares, borrowing & resource controllers, `scripts/sanitize_dataset.js`, and test suites |
| `firestore.indexes.json` | Composite Firestore index definitions for `BorrowingRequests` and `Events` queries |
| `src/services/` | Strongly-typed API client services (`api.ts`, `auth.ts`, `resources.ts`, `borrowing.ts`, `adminClubs.ts`) |
| `src/context/` | Application state management (`AppContext.tsx`) with live backend synchronization and route access guards (`viewAccess.ts`) |
| `src/components/` | Shared UI components (Layout, Navbar, Button, Card, FormField, Modals, StatusBadge) |
| `src/pages/` | Page components for borrowers, clubs, sustainability metrics, and admin dashboard |
| `src/types/` | TypeScript interfaces and type definitions for EventPool |
| `src/styles/theme.css` | Design tokens, typography, and color palette |
| `docs/` | Requirements, test strategy, design review, `api-contracts.md`, `BUGS.md`, `sprint-acceptance-checklist.md` |
| `evidence/` | Project evidence for the report: screenshots, interviews, finance, and backend verification logs |

## Frontend & Backend Integration

The React 19 frontend and the Express + Firebase backend are merged and fully integrated:

1. **Vite API Reverse Proxy:** Configured in `vite.config.ts` so that `/api/*` and `/uploads/*` requests from the browser automatically route to `http://localhost:5000` without CORS issues.
2. **Full-Stack API Service (`src/services/api.ts`):** Complete wrapper implementation for all API contract v1.1 endpoints (Auth, Admin, Clubs, Events, Resources, and Image Upload).
3. **State Synchronization (`src/context/AppContext.tsx`):** When the backend is online, live clubs, resources, and events are fetched from Firebase and synchronized into the UI. If offline, the application gracefully falls back to local storage.
4. **Unified NPM Scripts:** Root `package.json` scripts (`dev:backend`, `test:backend`) allow seamless developer workflows.

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
| **EPM-62 / EPM-63** | **Sprint 1 Stabilization, Borrowing APIs & QA Fixes** | BE-06 / Fixes | **Completed** | • **BUG-001 (Critical):** Implemented `/api/borrowing-requests` (`POST`, `GET`, `GET /:id`, `approve`, `reject`, `borrow`, `cancel`, `initiate-return`, `return`) with atomic Firestore transactions, plus `GET /api/sustainability` metrics endpoint.<br>• **BUG-003 (Option A):** Opened `GET /api/resources*` and `GET /api/clubs*` to public read access and updated `viewAccess.ts` so `/marketplace` and resource details load without login.<br>• **BUG-002 & BUG-004:** Standardized port `5000` across Express & Vite proxy; replaced literal API key in `backend/.env.example` with placeholder.<br>• **BUG-006:** Fixed real club resolution on sign-in in `AppContext.tsx`, `MyClubPage.tsx`, and `HomePage.tsx`.<br>• **Dataset & Anti-Pollution:** Sanitized Firestore/Auth (`4` controlled accounts, `3` clubs, `5` resources, `1` overdue + `1` pending request) and added guaranteed `finally` teardown cleanup to all test scripts. |

### Automated Verification & Evidence

All modules are covered by self-cleaning automated test suites that delete their temporary records in a `finally` block (leaving zero test pollution):
* **Core Backend Suite:** [`backend/tests/sprint1_verification.js`](backend/tests/sprint1_verification.js) — **41 / 41 PASSED**
* **Borrowing & Access-Control Suite:** [`backend/tests/borrowing_request_test.js`](backend/tests/borrowing_request_test.js) — **28 / 28 PASSED** (BUG-001 lifecycle, atomic concurrency transactions, BUG-003 Option A public reads, cancel & return verification)
* **Inventory Consistency Audit:** `npm run db:verify-inventory --prefix backend` — **5 / 5 resources verified, 0 discrepancies** (`total = available + reserved + borrowed`)
* **Frontend Type Check & Build:** `npm run lint` (`0` errors) and `npm run build` (`vite build` succeeded)
* **API Specification:** [`docs/api-contracts.md`](docs/api-contracts.md)
* **Firestore Composite Indexes:** [`firestore.indexes.json`](firestore.indexes.json)
* **Evidence Log:** [`evidence/sprint1_backend_verification.txt`](evidence/sprint1_backend_verification.txt)

## Deployment Guide (P8)

* **Backend ([`render.yaml`](render.yaml)):** Deploy `backend/` on Render/Fly.io with `npm start` and set environment variables: `PORT`, `FIREBASE_WEB_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` (raw or Base64 JSON), and `CORS_ORIGIN`.
* **Frontend ([`vercel.json`](vercel.json)):** Deployed on Vercel at https://event-pool.vercel.app/ (`npm run build`, output `dist/`) with `VITE_API_BASE_URL` pointing to the deployed backend URL and `VITE_FIREBASE_WEB_API_KEY`.

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
