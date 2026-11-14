# EventPool — Software Requirements Specification

**Project:** EventPool (Circular Resource-Sharing Platform for UM Student Clubs)  
**SDG Alignment:** SDG 12 (Responsible Consumption & Production), SDG 13 (Climate Action)

---

## 1. Overview

EventPool is a centralised web application enabling University of Malaya (UM) student clubs to list, discover, borrow, and return reusable event equipment. It replaces informal WhatsApp/personal-contact coordination with structured inventory management, accountability, and reuse tracking.

### User Roles

- **Club Representative:** Manages their club's profile, inventory, and transactions (can act as both borrower and owner).
- **Borrower:** Searches listings, submits requests, tracks status, and reports returns.
- **Resource Owner:** Manages listings, approves/rejects requests, and verifies returns.

### Scope

- **In Scope:** Resource marketplace & search, inventory management, borrowing workflow (request/approve/reject/cancel), conflict & overdue detection, return verification & condition tracking, club profiles, push notifications, privacy controls, and a sustainability dashboard.
- **Out of Scope:** Online payments/deposits, delivery/logistics, external UM system integrations, automated penalty collection, and native mobile apps.

---

## 2. Functional Requirements

> **Priority:** `Must` = Core MVP | `Should` = Secondary / Priority-dependent

| ID | Module | Requirement | Priority |
| :--- | :--- | :--- | :--- |
| **FR1.1** | Marketplace | Search and filter resources by name, category, availability, and location. | Must |
| **FR1.2** | Marketplace | Display resource details, owner club, available quantity, condition, and status. | Must |
| **FR1.3** | Marketplace | Display borrowing schedules based on the owner's privacy settings. | Should |
| **FR2.1** | Inventory | Authorised reps can add, edit, archive, and upload images for listings. | Must |
| **FR2.2** | Inventory | Resource owners can mark items as unavailable. | Must |
| **FR2.3** | Inventory | Automatically update inventory upon approvals, cancellations, and verified returns. | Must |
| **FR2.4** | Inventory | Clubs can configure visibility for contact details and borrowing schedules. | Should |
| **FR3.1** | Borrowing | Borrowers submit requests with resource, quantity, event, purpose, and pickup/return dates. | Must |
| **FR3.2** | Borrowing | Validate requested quantities, availability, and date ranges upon submission. | Must |
| **FR3.3** | Borrowing | Owners can approve (reserving quantity) or reject requests. | Must |
| **FR3.4** | Borrowing | Borrowers can view request history/status and cancel requests where permitted. | Must |
| **FR3.5** | Borrowing | Flag overdue requests (`Must`) and detect conflicting borrowing periods (`Should`). | Must / Should |
| **FR3.6** | Borrowing | Send return reminders, status notifications via Firebase, and log late-return penalties (if policy exists). | Should |
| **FR4.1** | Club Profiles | Display club info, listed resources, and borrowing/lending history. | Must |
| **FR4.2** | Club Profiles | Authorised reps can manage their club's active transactions. | Must |
| **FR5.1** | Returns | Borrowers report returns; owners verify them and record item condition. | Must |
| **FR5.2** | Returns | Owners can log damaged or missing items upon return. | Must |
| **FR5.3** | Returns | Restore **only** verified reusable quantities to inventory and retain return records. | Must |
| **FR6.1** | Sustainability | Display completed sharing transactions and total quantity of reused resources. | Must |
| **FR6.2** | Sustainability | Estimate avoided expenditure and waste when reliable item data is available. | Should |
| **FR6.3** | Sustainability | Clearly label all sustainability metrics as estimates and state underlying assumptions. | Must |

### Borrowing Lifecycle & Statuses

1. **Pending:** Awaiting owner decision.
2. **Approved:** Accepted; requested quantity is reserved.
3. **Rejected:** Declined; no quantity reserved.
4. **Borrowed:** Item collected by borrower.
5. **Return Pending:** Borrower reported return; awaiting owner verification.
6. **Completed:** Owner verified return; reusable quantities restored.
7. **Cancelled:** Request withdrawn; any reserved quantities released.
8. **Overdue (Flag):** Indicator applied to active borrowings past their expected return date (does not overwrite base status).

---

## 3. Non-Functional Requirements

| ID | Category | Requirement |
| :--- | :--- | :--- |
| **NFR1** | Performance | Search results must render within 3 seconds under normal load. |
| **NFR2** | Usability | Clear labels and consistent workflows requiring minimal user training. |
| **NFR3** | Compatibility | Support modern desktop/mobile web browsers and responsive screen sizes. |
| **NFR4** | Access Control | Only authorised club representatives can manage their club's resources and transactions. |
| **NFR5** | Data Integrity | Available resource quantities must never drop below zero. |
| **NFR6** | Concurrency | Simultaneous approvals must use atomic/transaction-safe PostgreSQL operations to prevent overbooking. |
| **NFR7** | Privacy | Restricted schedules and contact info must only be exposed to permitted users. |
| **NFR8** | Reliability | Failed database updates must roll back cleanly without leaving partial inventory states. |
| **NFR9** | Auditability | Retain all completed borrowing and return records for reporting and accountability. |
| **NFR10** | Transparency | Sustainability calculations must explicitly document their assumptions and limitations. |

---

## 4. Business Rules & Inventory Logic

- **Authorization:** Only verified club reps can mutate their club's listings or approve/verify transactions.
- **Reservation & Stock:**
  - Approval reserves stock; rejection or cancellation releases it.
  - Borrower return reports do **not** restore stock; only owner verification restores reusable units.
  - Damaged or missing units are permanently deducted from available inventory.
  - Archiving a listing hides it from new requests without deleting historical records.
- **Data Separation:** Resource availability and request statuses are tracked independently.

### Inventory State Example

| Action | Available Stock |
| :--- | :---: |
| Initial listing created | `2` |
| Request for 1 unit approved (Reserved) | `1` |
| Borrower collects item (`Borrowed`) | `1` |
| Owner verifies return as reusable (`Completed`) | `2` |

---

## 5. System Architecture & Data Model

### Logical Architecture

```text
       [Club Reps: Borrowers / Owners]
                      |
                      v
         [EventPool Web Application]
         ├── Marketplace & Search
         ├── Inventory & Club Profiles
         ├── Borrowing & Return Workflows
         └── Sustainability Dashboard
              |               |
              v               v
        [Supabase]       [Firebase]
  ├── PostgreSQL DB      └── Cloud Messaging (FCM)
  ├── Auth & RLS             (Push Notifications &
  └── Storage (Images)        Return Reminders)
```

- **Supabase (Primary Backend):** Handles relational data storage (PostgreSQL), Row-Level Security (RLS) for club-level access control, ACID transactions for inventory reservations, and object storage for resource images.
- **Firebase (Notifications):** Handles Firebase Cloud Messaging (FCM) to deliver real-time push notifications for request updates and automated return reminders.

### Core Entities (Supabase PostgreSQL)

- **Users:** `userId`, `name`, `email`, `clubIds`, `role`, `fcmToken`
- **Clubs:** `clubId`, `clubName`, `description`, `representativeIds`, `privacySettings`
- **Resources:** `resourceId`, `ownerClubId`, `itemName`, `category`, `totalQuantity`, `availableQuantity`, `condition`, `location`, `status`, `imageUrl`
- **Events:** `eventId`, `clubId`, `eventName`, `eventDate`, `purpose`
- **BorrowingRequests:** `requestId`, `resourceId`, `requesterClubId`, `ownerClubId`, `quantity`, `pickupDate`, `returnDate`, `status`
- **ReturnRecords:** `returnId`, `requestId`, `reusableQuantity`, `damagedQuantity`, `missingQuantity`, `condition`, `verifiedAt`
- **Notifications:** `notificationId`, `userId`, `requestId`, `type`, `createdAt`, `readStatus`

---

## 6. Definition of Done (Demo Readiness)

The MVP is complete when end-to-end testing verifies:

- [ ] Users can search, filter, and view resources respecting club privacy settings.
- [ ] Authorised reps can create, edit, and archive resource listings (including image uploads).
- [ ] Borrowers can submit valid requests, view status, and report returns.
- [ ] Owners can approve/reject requests, flag conflicts/overdue items, and verify return conditions.
- [ ] Inventory updates atomically via Supabase transactions (reserving on approval, excluding damaged/missing units on return).
- [ ] Push notifications trigger accurately via Firebase for status updates and reminders.
- [ ] Sustainability dashboard displays completed transactions, reused counts, and clearly labelled estimates.

---

## 7. Open Decisions

- **Trigger Mechanism:** Decide how Supabase triggers Firebase FCM pushes (e.g., Supabase Database Webhooks + Edge Functions vs. scheduled cron jobs for overdue reminders).
- **Policies:** Confirm supported browser matrix, default privacy tiers, late-return penalty rules, and sustainability estimation formulas.
