# BUGS — EventPool Defect Log

**Owner:** QA Engineer (M9)  
**Related:** Jira `EPM-24` · Gantt task `4.1` · test plan in [`test-strategy.md`](test-strategy.md)

This file is the single record of every defect found in EventPool. A defect that is not written here does not exist for the team: it will not be fixed, it will not be counted in the final report, and it cannot be used as evidence of testing work. Every entry also gets a matching Jira issue when it blocks a sprint goal, using the same `BUG-nn` identifier.

---

## Severity guide

| Severity     | Meaning                                                                                                                                     | Target fix                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Critical** | A core flow cannot be completed at all — for example a borrowing request can never be approved, or the app crashes on login.                | Same week as reported     |
| **Major**    | A main function returns a wrong result, but a workaround exists — for example the stock count is wrong by one but the flow still completes. | Within the current sprint |
| **Minor**    | Interface, wording or cosmetic issue that does not block any task.                                                                          | Before sign-off           |

## Status guide

`Open` → `In Progress` → `Fixed` → `Closed`

A defect moves to `Closed` only after QA re-runs the original failing case **and** the related regression cases. A defect closed without that verification is reopened.

---

## Open defects

No defects are recorded yet. The first execution round begins in week 7 (Gantt task 4.2); entries are added from that point onward.

| ID | Title | Module | Severity | Status | Reported | Assigned |
| -- | ----- | ------ | -------- | ------ | -------- | -------- |
| —  | —     | —      | —        | —      | —        | —        |

## Closed defects

| ID | Title | Module | Severity | Fixed in | Verified by |
| -- | ----- | ------ | -------- | -------- | ----------- |
| —  | —     | —      | —        | —        | —           |

---

## Entry template

Copy this block for each new defect. Do not delete any field; write `n/a` when a field genuinely does not apply, so that a missing field always means "forgot to fill it in".

```markdown
### BUG-000 — <one sentence describing the problem>

- **Module:** M1 Resource Marketplace
- **Severity:** Critical / Major / Minor
- **Found in:** <version, sprint or date>
- **Jira issue:** EPM-00 / none
- **Reported by:** <name> · **Assigned to:** <name>
- **Status:** Open

**Preconditions**
<what must be true before the steps can be followed>

**Steps to reproduce**
1.
2.
3.

**Expected result**
<what the system should do>

**Actual result**
<what the system does instead>

**Evidence**
<screenshot or screen recording link>

**Notes / suspected cause**
<optional — only if the reporter has a concrete suspicion; do not guess>
```

---
