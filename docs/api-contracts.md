# EventPool API Contract Specification (v1.1)

**Base URL:** `/api` (Local development: `http://localhost:5000/api`)  
**Authentication:** Firebase ID Token passed via `Authorization: Bearer <firebase_id_token>`  
**Timestamps:** All timestamps are returned in ISO 8601 UTC format (`YYYY-MM-DDTHH:mm:ss.sssZ`).

---

## 1. Standard Response & Error Formats

### Success Envelope
```json
{
  "success": true,
  "message": "Descriptive success message",
  "data": { ... }
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Human-readable error explanation",
  "error": {
    "code": "MACHINE_READABLE_ERROR_CODE"
  }
}
```

### Standard Error Codes
| HTTP Status | Error Code | Meaning |
| :---: | :--- | :--- |
| `400` | `INVALID_INPUT` / `INVALID_DATE_RANGE` / `INVALID_FILE` | Missing or malformed request parameters |
| `401` | `UNAUTHORIZED` | Missing, malformed, or expired Bearer token |
| `403` | `FORBIDDEN` | Authenticated role or club does not own the target resource |
| `403` | `ACCOUNT_DISABLED` | Club account has `isActive === false` |
| `404` | `NOT_FOUND` / `*_NOT_FOUND` | Requested route or entity does not exist |
| `409` | `EMAIL_ALREADY_EXISTS` | Email already registered in Firebase Auth |
| `409` | `QUANTITY_CONFLICT` | Requested `totalQuantity < reservedQuantity + borrowedQuantity` |
| `409` | `INSUFFICIENT_QUANTITY` | Requested quantity exceeds `availableQuantity` |
| `409` | `RESOURCE_HAS_ACTIVE_BORROWINGS` | Cannot archive resource with active/pending borrowings |
| `409` | `INVALID_STATUS_TRANSITION` | Borrowing state transition not allowed from current status |
| `413` | `FILE_TOO_LARGE` | Uploaded image exceeds 5 MB limit |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Uploaded file is not `image/jpeg` or `image/png` |

---

## 2. Authentication Endpoints (`/api/auth`)

### `GET /api/auth/profile`
* **Access:** Authenticated (`Admin` or active `Club`)
* **Response (`200 OK`):**
  * For Club:
    ```json
    {
      "success": true,
      "message": "Profile retrieved successfully",
      "data": {
        "accountType": "club",
        "clubId": "club-pekom",
        "clubName": "Persatuan Komputer Universiti Malaya",
        "email": "pekom.club@um.edu.my"
      }
    }
    ```
  * For Admin:
    ```json
    {
      "success": true,
      "message": "Profile retrieved successfully",
      "data": {
        "accountType": "admin",
        "adminId": "pmzzDZPXoPPJy12DFxXOdc932Bv1",
        "adminName": "System Administrator",
        "email": "admin@admin.com"
      }
    }
    ```

---

## 3. Admin & Dashboard Endpoints (`/api/admin`)

All `/api/admin/*` routes require `authenticate` + `requireAdmin` (`403 FORBIDDEN` for clubs).

### `GET /api/admin/profile`
* **Response (`200 OK`):** `{ adminId, adminName, email, isActive: true }`

### `POST /api/admin/clubs`
* **Request Body:** `{ clubName, description (optional), contactEmail, picContactNum, password }`
* **Behavior:** Atomically creates Firebase Auth user and Firestore `Clubs` document; rolls back Auth user if Firestore write fails.
* **Response (`201 Created`):** `{ clubId, clubName, contactEmail, isActive: true }`

### `PATCH /api/admin/clubs/:clubId/deactivate`
* **Behavior:** Sets `isActive: false` in Firestore and disables user in Firebase Auth. Historical resources and requests remain intact.
* **Response (`200 OK`):** `{ clubId, isActive: false }`

### `GET /api/admin/dashboard`
* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Dashboard statistics retrieved successfully",
    "data": {
      "totalClubs": 3,
      "activeClubs": 2,
      "totalResources": 5,
      "totalBorrowingRequests": 2,
      "pendingRequests": 1,
      "completedRequests": 0
    }
  }
  ```

---

## 4. Club & Event Endpoints (`/api/clubs`, `/api/events`)

### `GET /api/clubs`
* **Access:** Public (BUG-003 Option A)
* **Response (`200 OK`):** Array of `{ clubId, clubName, description, contactEmail, picContactNum, isActive }`

### `GET /api/clubs/:clubId`
* **Access:** Public (BUG-003 Option A)
* **Response (`200 OK`):** `{ clubId, clubName, description, contactEmail, picContactNum, createdAt, isActive }` or `404 CLUB_NOT_FOUND`

### `PATCH /api/clubs/:clubId`
* **Access:** Authenticated (`Club` own `clubId` only, or `Admin` any club)
* **Request Body:** `{ clubName, description, contactEmail, picContactNum }` (partial updates allowed; changing `contactEmail` syncs to Firebase Auth)
* **Response (`200 OK`):** `{ clubId, clubName, contactEmail }`

### `POST /api/events`
* **Access:** Authenticated (`requireClub`)
* **Request Body:** `{ eventName, eventDate, purpose, description (optional) }`
* **Response (`201 Created`):** `{ eventId, clubId, eventName, eventDate, purpose }`

### `GET /api/events`
* **Access:** Authenticated (`Club` sees own events; `Admin` sees all, optional `clubId` and `eventDate` query filters)
* **Response (`200 OK`):** Array of event objects.

### `PATCH /api/events/:eventId`
* **Access:** Authenticated (`requireClub` owner or `Admin`)
* **Request Body:** `{ eventName, eventDate, purpose, description }`

---

## 5. Resource Endpoints (`/api/resources`)

### Resource Status Derivation Rule
* `isTemporarilyUnavailable === true` $\rightarrow$ `'Unavailable'`
* Else `availableQuantity > 0` $\rightarrow$ `'Available'`
* Else `reservedQuantity > 0` $\rightarrow$ `'Reserved'`
* Else $\rightarrow$ `'Borrowed'`

### Inventory Invariant
$$\text{totalQuantity} = \text{availableQuantity} + \text{reservedQuantity} + \text{borrowedQuantity}$$

### `GET /api/resources`
* **Access:** Public (BUG-003 Option A)
* **Query Params:** `category`, `status`, `clubId`, `location`, `page` (default `1`), `limit` (default `10`)
* **Behavior:** Excludes archived resources (`isArchived: true`) and resources belonging to inactive clubs.
* **Response (`200 OK`):** `{ items: [...], pagination: { page, limit, total, totalPages } }`

### `GET /api/resources/search`
* **Access:** Public (BUG-003 Option A)
* **Query Params:** `q` (case-insensitive substring match on `itemName` / `description`), plus all filters & pagination from `GET /api/resources`.

### `GET /api/resources/:resourceId`
* **Access:** Public (BUG-003 Option A)
* **Response (`200 OK`):** Full resource object or `404 RESOURCE_NOT_FOUND`.

### `POST /api/resources`
* **Access:** Authenticated (`requireClub`)
* **Request Body:** `{ itemName, category, description, totalQuantity, condition, location, remarks, estimatedUnitCost, estimatedUnitWeight }`
* **Response (`201 Created`):** Created resource object with `availableQuantity = totalQuantity`, `status = 'Available'`.

### `PATCH /api/resources/:resourceId`
* **Access:** Authenticated (`requireClub` + owner check)
* **Request Body:** Any updatable fields; if `totalQuantity` is changed, validates `totalQuantity >= reservedQuantity + borrowedQuantity` (`409 QUANTITY_CONFLICT`).

### `PATCH /api/resources/:resourceId/archive`
* **Access:** Authenticated (`requireClub` + owner check)
* **Behavior:** Rejects with `409 RESOURCE_HAS_ACTIVE_BORROWINGS` if units are reserved/borrowed or active requests exist. Soft-deletes by setting `isArchived: true`.

### `PATCH /api/resources/:resourceId/availability`
* **Access:** Authenticated (`requireClub` + owner check)
* **Request Body:** `{ isTemporarilyUnavailable (or manualUnavailable): boolean, remarks (optional) }`

### Resource Image Endpoints
* **`POST /api/resources/:resourceId/image`** (`requireClub` + owner): Multipart form field `image` (`image/jpeg` or `image/png`, $\le$ 5 MB). Uploads to Firebase Storage or local `/uploads/resources/` fallback. Returns `{ resourceId, imageURL }`.
* **`GET /api/resources/:resourceId/image`** (Public): Returns `{ resourceId, imageURL }` or `404 IMAGE_NOT_FOUND`.
* **`DELETE /api/resources/:resourceId/image`** (`requireClub` + owner): Deletes image and sets `imageURL: null`.

---

## 6. Borrowing Request Endpoints (`/api/borrowing-requests`)

All `/api/borrowing-requests/*` endpoints require `authenticate`.

### Borrowing Lifecycle State Machine
```
Pending ──[owner approve]──▶ Approved ──[owner borrow]──▶ Borrowed ──[borrower initiate-return]──▶ Return Pending ──[owner return]──▶ Completed
   │                            │
   ├─[owner reject]──▶ Rejected │
   └─[borrower cancel]──────────┴─[borrower cancel]──▶ Cancelled
```

### `POST /api/borrowing-requests`
* **Access:** Authenticated (`requireClub`)
* **Request Body:** `{ resourceId, eventId (optional), quantity, purpose, pickupDate, expectedReturnDate, wouldHavePurchased, remarks }`
* **Validations:** Cannot borrow own resource (`403 FORBIDDEN`); `expectedReturnDate > pickupDate` (`400 INVALID_DATE_RANGE`); `quantity <= availableQuantity` (`409 INSUFFICIENT_QUANTITY`).
* **Response (`201 Created`):** Created request with `status: 'Pending'`.

### `GET /api/borrowing-requests`
* **Access:** Authenticated (`Club` sees own incoming/outgoing; `Admin` sees all)
* **Query Params:** `direction` (`incoming` | `outgoing`), `status`, `clubId`, `resourceId`
* **Computed Field:** `isOverdue` is dynamically computed (`['Approved', 'Borrowed', 'Return Pending'].includes(status) && expectedReturnDate < todayISO`).

### `GET /api/borrowing-requests/:requestId`
* **Access:** Authenticated (Owner club, Borrower club, or Admin only)

### `PATCH /api/borrowing-requests/:requestId/approve`
* **Access:** Owner Club (`requireClub`)
* **Transaction:** Atomically decrements `availableQuantity` and increments `reservedQuantity`, sets request `status: 'Approved'`.

### `PATCH /api/borrowing-requests/:requestId/reject`
* **Access:** Owner Club (`requireClub`)
* **Request Body:** `{ reason (optional) }`
* **Behavior:** Transitions `Pending` $\rightarrow$ `Rejected`. Inventory unchanged.

### `PATCH /api/borrowing-requests/:requestId/borrow`
* **Access:** Owner Club (`requireClub`)
* **Transaction:** Transitions `Approved` $\rightarrow$ `Borrowed`; atomically moves units from `reservedQuantity` to `borrowedQuantity`.

### `PATCH /api/borrowing-requests/:requestId/cancel`
* **Access:** Borrower Club (`requireClub`)
* **Transaction:** Transitions `Pending` or `Approved` $\rightarrow$ `Cancelled`. If `Approved`, releases `reservedQuantity` back to `availableQuantity`.

### `PATCH /api/borrowing-requests/:requestId/initiate-return`
* **Access:** Borrower Club (`requireClub`)
* **Behavior:** Transitions `Borrowed` $\rightarrow$ `Return Pending` and records `returnedDate`.

### `POST /api/borrowing-requests/:requestId/return`
* **Access:** Owner Club (`requireClub`)
* **Request Body:** `{ reusable (or usable), damaged, missing, returnCondition (optional) }`
* **Validations:** `reusable + damaged + missing === quantity` (`400 INVALID_INPUT`).
* **Transaction:** Transitions `Borrowed` / `Return Pending` $\rightarrow$ `Completed`; moves `reusable` to `availableQuantity`, subtracts `damaged + missing` from `totalQuantity`.

The legacy `PATCH /api/borrowing-requests/:requestId/return` endpoint submits
return information as the borrower and transitions `Borrowed` to `Return
Pending`. `PATCH .../initiate-return` is also available for this transition.
Owner verification is performed by the `POST .../return` endpoint.

The UI's club list queries filter requests by `requesterClubId` or
`ownerClubId`, optionally combined with `status` and/or `resourceId`.
`firestore.indexes.json` defines the required two- and three-field composite
indexes for these query combinations.

---

## 7. Sustainability & Metrics Endpoint (`/api/sustainability`)

### `GET /api/sustainability`
* **Access:** Public
* **Query Params:** `clubId` (optional)
* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Sustainability metrics retrieved successfully",
    "data": {
      "completedTransactions": 1,
      "totalReusedUnits": 3,
      "estimatedCostSavedRM": 600,
      "estimatedWasteAvoidedKg": 4.5,
      "activeClubs": 2,
      "totalClubs": 3,
      "disclaimer": "Figures are estimated savings based on completed borrowing records where borrowers indicated they would otherwise have purchased the item."
    }
  }
  ```
