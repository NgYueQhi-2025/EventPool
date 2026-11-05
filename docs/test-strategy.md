# EventPool — Test Strategy & Test Cases

**Course:** WIX2002 Project Management  
**Deliverable for:** Jira `EPM-23` · Gantt task `4.1` (test planning and defect log)  
**Author:** WEI XIN — QA Engineer (M9)  
**Version:** v0.2 (draft for review) · **Date:** 5 November 2026  
**Reviewer:** Ng Yue Qhi (Team Leader)

---

## Contents

1. [Document Information](#1-document-information)
2. [Introduction](#2-introduction)
3. [Test Scope](#3-test-scope)
4. [Test Strategy](#4-test-strategy)
5. [Test Environment and Tools](#5-test-environment-and-tools)
6. [Test Case Template and Sample Cases](#6-test-case-template-and-sample-cases)
7. [Defect Management](#7-defect-management)
8. [Test Schedule](#8-test-schedule-aligned-with-the-gantt-chart)
9. [Entry and Exit Criteria](#9-entry-and-exit-criteria)
10. [Risks and Dependencies](#10-risks-and-dependencies)
11. [Glossary](#11-glossary)
12. [Sign-off](#12-sign-off)

---

## Executive Summary

| Modules tested | Test layers | Borrowing states | QA phases |
| :------------: | :---------: | :--------------: | :-------: |
|      **6**     |    **4**    |       **7**      |   **5**   |

This document is the master test plan for EventPool, a web application that allows student clubs to share idle event resources instead of purchasing duplicates. It defines what will be tested, how, when, and how defects are handled.

Testing covers the six functional modules and the complete borrowing lifecycle in four layers — functional, integration, regression and user acceptance — with the schedule mapped week by week to Gantt tasks 4.1, 4.2, 4.4, 4.5 and 4.7. Every defect is recorded in [`BUGS.md`](BUGS.md) and mirrored as a Jira issue, and may only be closed after regression verification.

---

## 1. Document Information

| Item              | Details                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project name      | EventPool (ClubCycle) — a circular resource-sharing platform for student clubs at Universiti Malaya                                                       |
| Course            | WIX2002 Project Management                                                                                                                                |
| Document type     | Test Strategy and Test Cases                                                                                                                              |
| Related tasks     | Jira EPM-23; Gantt task 4.1                                                                                                                               |
| Author            | WEI XIN — QA Engineer (M9)                                                                                                                                |
| Version and date  | v0.2 draft / 5 November 2026                                                                                                                              |
| Reviewer          | Ng Yue Qhi (Team Leader)                                                                                                                                  |
| Related documents | Project proposal; PM Group Assignment (WBS); EventPool Gantt chart; system design and database schema (Admin, Club, Resources, Events, BorrowingRequests) |

## 2. Introduction

This chapter explains where the testing work comes from: what the project is, who this document is written for, and what "successful testing" means for the team.

### 2.1 Project Background

EventPool is a web application for student clubs. A club can list the event resources it owns but rarely uses — banners, decorations, lighting and sound equipment — so that other clubs can search for them, request a loan, and return them afterwards. The aim is to stop every club from buying the same items once or twice a year.

The project aligns with SDG 12 (Responsible Consumption and Production) and SDG 13 (Climate Action). The solution is delivered as a Figma prototype plus a web application built on a cloud database (Firebase).

### 2.2 Purpose of This Document

This document states how the team intends to test EventPool: what is tested, by which method, at what point in the schedule, and how a defect is recorded and resolved once found. It is the reference for all later testing activities (Gantt tasks 4.2, 4.4, 4.7) and provides the material for the testing section of the final project report.

### 2.3 Test Objectives

- Confirm that each of the six functional modules behaves as specified under normal operation.
- Confirm that the borrowing lifecycle follows the designed state machine, with no dead ends and no illegal states.
- Confirm that when two or more clubs act on the same resource at the same time, the data does not conflict — for example, that a single item cannot be lent out twice.
- Confirm through user acceptance testing that real club committee members find the product usable and understandable.
- Ensure that every defect found is recorded in `BUGS.md` so that it can be tracked and closed.

## 3. Test Scope

This chapter draws the boundary of the testing effort: which modules are tested, which flow matters most, and what is explicitly excluded at this stage.

### 3.1 Modules Under Test

| Module | Name                          | Key functions to verify                                                                               |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| M1     | Resource Marketplace          | Keyword search, multi-criteria filtering, resource detail page, live availability badge               |
| M2     | Resource Management           | Create a listing, edit or withdraw a listing, storage location note, maintenance status switch        |
| M3     | Borrowing Request             | Submit a request, approve or reject, stock locking, release on cancellation, overdue reminder         |
| M4     | Club Profiles                 | Club details, current listings, incoming and outgoing requests, borrowing history                     |
| M5     | Return and Condition Tracking | Initiate return, owner inspection, damage or loss recording, stock restoration                        |
| M6     | Sustainability Dashboard      | Reuse counter, avoided-purchase and cost-saving estimates, waste avoided calculation, disclaimer text |

### 3.2 Priority Scenario: the Borrowing State Machine

A borrowing request in the system design can hold seven states, and every transition between them must behave correctly. Each transition below becomes at least one test case. The most important property to verify is that rejecting or cancelling a request always restores the available quantity.

| Current state             | Trigger                         | Next state                        |
| ------------------------- | ------------------------------- | --------------------------------- |
| Pending                   | Owner approves the request      | `Approved`                        |
| Pending                   | Owner rejects the request       | `Rejected` (stock unchanged)      |
| Approved                  | Borrower confirms collection    | `Borrowed` (stock locked)         |
| Borrowed                  | Borrower initiates return       | `Return Pending`                  |
| Return Pending            | Owner accepts the returned item | `Completed` (stock restored)      |
| Pending / Approved        | Either party cancels            | `Cancelled` (stock released)      |
| Borrowed / Return Pending | Return deadline passes          | `Overdue` (flagged, not blocking) |

### 3.3 Out of Scope

The following are not tested at this stage and are listed here so that the boundary is explicit: security and penetration testing, load and stress testing, multi-language support, and payment or deposit handling. Any change to this list is agreed with the team leader and recorded as a new version of this document.

## 4. Test Strategy

Testing is organised in four layers that move from the inside out and from the development phase to the delivery phase. Each layer below explains the concept first, then states how it is applied to EventPool and who is responsible.

### 4.1 Functional Testing

**What it is.** Verifying each function in isolation against the requirement: valid input should succeed, invalid input should be rejected with a clear message.

**How it is applied.** Test cases are written module by module using the template in Section 6, covering both the normal path and the error path. For example, in M1 search: a keyword that matches an existing listing returns results, while a keyword that matches nothing shows an empty-state message rather than an error.

**Responsibility.** Executed by the QA Engineer (M9); defects are fixed by the developer who owns the module (M5–M8).

### 4.2 Integration Testing

**What it is.** Verifying that modules work correctly once connected. Each function may pass on its own while data passed between modules is still wrong.

**How it is applied.** The cross-module data flow is tested end to end: a listing created in M2 must appear immediately in M1 search with an "Available" badge; submitting a request in M3 must change that badge to "Reserved"; completing the return in M5 must restore it to "Available". The interface and the Firebase database are also checked for consistency — the quantity shown on screen must equal the quantity actually stored.

**Responsibility.** Executed by the QA Engineer together with the frontend and backend developers.

### 4.3 Regression Testing

**What it is.** Re-running the previously passed core tests after a bug fix or a new feature, to confirm that nothing that used to work has been broken.

**How it is applied.** A core regression list of roughly 15 to 20 cases is maintained — club registration and login, search, borrowing, approval, return, and the dashboard figures. The full list is executed at the end of every sprint and again before final sign-off in week 12 (Gantt task 4.7), with the result of each run recorded.

**Responsibility.** Executed by the QA Engineer; results are reported at the weekly team meeting.

### 4.4 User Acceptance Testing (UAT)

**What it is.** Real target users — club committee members — carry out scripted tasks on the product to confirm that it is usable and understandable for them. It is the final gate before delivery.

**How it is applied.** The Requirements & Research Analyst (M2) prepares the UAT script and invites club representatives (Gantt task 4.5), while QA supplies five to eight realistic tasks: register, list a resource, search for one, request a loan, return it. Where participants hesitate or fail, the observation is recorded and converted into a defect or an improvement suggestion.

**Responsibility.** Script and participants by M2; task design and observation notes by the QA Engineer.

## 5. Test Environment and Tools

Testing is carried out in a dedicated environment so that test data never mixes with any demonstration data used in presentations.

| Item                     | Details                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Test environment         | [To be confirmed: Firebase test project URL / local development URL]                                       |
| Browsers                 | Chrome (primary), Safari (spot check)                                                                      |
| Test data                | [To be confirmed: owner of the seed data — at least two test clubs and five resources in different states] |
| Task and defect tracking | Jira (EPM board) and `BUGS.md` in the GitHub repository                                                    |
| Prototype validation     | Clickable Figma prototype, used to validate flow design before the corresponding feature is built          |
| Evidence                 | Screenshot or short screen recording attached to every Major and Critical defect                           |

## 6. Test Case Template and Sample Cases

A test case is the smallest unit of test execution: one documented check that either passes or fails. This chapter fixes the template the team will use, then demonstrates it with six real EventPool scenarios. Before execution begins in week 7, the set is expanded to cover every module.


### 6.1 Test Case Template

| Field | Description |
|---|---|
| Case ID | `TC-M<module>-<number>`, for example `TC-M1-01` |
| Module | One of the modules in Section 3.1 |
| Title | One sentence stating what is checked |
| Preconditions | State that must exist before the steps can be carried out |
| Steps | Numbered, repeatable actions |
| Expected result | What the system must show after each step |
| Actual result | Filled in during execution |
| Priority | High / Medium / Low |
| Status | Pass / Fail / Blocked / Not Run |

### 6.2 Sample Test Cases

| Case ID | Title | Preconditions | Steps | Expected result | Priority |
|---|---|---|---|---|---|
| TC-M1-01 | Search returns an existing listing | A club has listed "Event Banner" | 1. Log in as a club account. 2. Type "banner" in the search field. 3. Submit the search. | The listing appears in the results with an "Available" badge. | **High** |
| TC-M1-02 | Search with no match shows an empty state | No listing contains the keyword | 1. Type "zzz" in the search field. 2. Submit the search. | An empty-state message is shown; no error page and no stack trace. | Medium |
| TC-M3-01 | Borrowing request submitted normally | Two clubs registered; the resource is Available | 1. Open the resource. 2. Enter quantity, purpose and dates. 3. Submit. | The request is Pending, the owner is notified, and available quantity is unchanged. | **High** |
| TC-M3-05 | Concurrent request locks the stock | `totalQuantity = 1` and the resource is Available | Two clubs submit a request for the same dates; the owner processes both. | Only one request can reach Borrowed; the second is refused or blocked with an "insufficient stock" message. | **High** |
| TC-M3-07 | Rejection restores stock | A Pending request has already reserved 2 units | The owner rejects the request. | State becomes Rejected and `availableQuantity` increases by 2. | **High** |
| TC-M5-02 | Stock restored after a return | A Borrowed record exists with quantity 2 | 1. The borrower initiates the return. 2. The owner accepts it. | The record becomes Completed and `availableQuantity` increases by 2. | **High** |

## 7. Defect Management

Every defect is written to [`BUGS.md`](BUGS.md) in the team GitHub repository and, where it blocks a sprint goal, also raised as a Jira issue. Both records carry the same identifier so that the two tools stay linked. Each entry contains the following fields.

| Field | Description |
|---|---|
| ID | `BUG-012` (numbering runs in sequence) |
| Title | One sentence describing the problem |
| Module | The module in which the defect was found |
| Severity | **Critical**: a core flow cannot be completed. **Major**: a main function is wrong but a workaround exists. **Minor**: interface or wording issue. |
| Steps to reproduce | 1. 2. 3. — detailed enough for another person to repeat |
| Expected vs actual | What should happen, and what happens instead |
| Evidence | [Link to screenshot or screen recording] |
| Status | `Open → In Progress → Fixed → Closed` |
| Reported by / assigned to | QA Engineer / the developer who owns the module |

> **Handling rule.** Every Critical defect is fixed in the same week it is reported. After a fix, QA re-runs the failing case plus the related regression cases; only then is the defect closed. A defect closed without verification is treated as reopened.

## 8. Test Schedule (Aligned with the Gantt Chart)

The testing effort is not a single phase at the end of the project. It starts in week 5 with planning and runs alongside development until sign-off in week 12, following the QA rows of the Gantt chart.

| Phase | Gantt task | Weeks | QA activity |
|---|---|---|---|
| Test preparation | 4.1 | Weeks 5–6 (2–13 Nov) | Complete this document; set up the case template and the defect log; review the system design for testability (EPM-24) |
| Catalogue feature testing | 4.2 | Weeks 7–8 (16–27 Nov) | Functional and integration testing of M1 and M2; expand the case set for M3 and M4 |
| End-to-end and concurrency testing | 4.4 | Weeks 9–10 (30 Nov–11 Dec) | Full borrow-and-return flow across M3 and M5; concurrent request scenarios; M6 dashboard figures |
| User acceptance testing | 4.5 | Week 11 (14–18 Dec) | Support the Analyst in running UAT; record observations and convert them into defects |
| Regression and sign-off | 4.7 | Week 12 (21–25 Dec) | Run the core regression list; produce the test summary; give a sign-off recommendation |

## 9. Entry and Exit Criteria

Clear criteria at both ends of each phase keep the work from drifting into open-ended testing.

> **Entry criteria.** The module under test is built and deployed to the test environment; seed data is loaded; the relevant test cases have been reviewed by the team leader.

> **Exit criteria.** One hundred per cent of High-priority cases have been executed; no Critical or Major defect remains open; Minor defects are recorded with a fix plan; UAT feedback has been collected and classified.

## 10. Risks and Dependencies

Two dependencies sit outside the control of the QA role, and both are managed by asking early rather than waiting.

| Risk or dependency | Impact | Response |
|---|---|---|
| System design and database schema arrive late from the backend team | EPM-24 design review cannot start | Request Gantt tasks 2.5 and 2.6 outputs from the Backend Lead this week |
| Test environment or seed data not ready in time | Cases cannot be executed in week 7 | Confirm the environment owner and the data readiness date at the weekly meeting |
| Fixes take longer than one week, eating the regression window | Sign-off in week 12 is at risk | Clear Critical defects within the reporting week; review the open defect list every week |
| Features change after testing has begun | Executed cases become invalid | Re-run the affected cases and version this document when scope changes |

## 11. Glossary

| Term | Working definition |
|---|---|
| Test case | A documented set of steps together with the expected result, so that anyone can repeat the check and judge whether the feature is correct. |
| State machine | A design in which an object — here a borrowing request — may only move between states along defined paths. |
| Concurrency | Two or more users acting on the same record at the same moment; the situation most likely to expose data errors. |
| Regression | Re-testing features that already passed, after a change, to make sure nothing was broken. |
| Happy path | The normal, expected route through a feature with valid input and no exceptions. |
| Sign-off | The formal confirmation by the person responsible for quality that the product is ready to be delivered. |

## 12. Sign-off

This document is reviewed and accepted by the roles below. A later revision requires a new version number and a new dated signature.

| Role | Name | Signature and date |
|---|---|---|
| Author — QA Engineer (M9) | WEI XIN | |
| Reviewer — Project Manager | Ng Yue Qhi | |
| Technical reviewer — Backend Lead | Jasmine Chin | |
