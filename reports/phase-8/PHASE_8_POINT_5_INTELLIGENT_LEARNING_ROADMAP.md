# NEXUS — Phase 8 Point 5: Intelligent Learning Roadmap
## Final Technical Design Proposal (Revision 4 — Technical Audit Corrections Applied)

**Date:** 2026-11-10  
**Status:** DESIGN ONLY — Awaiting Implementation Approval  
**Author:** Claude Sonnet 4.6  
**Scope:** Technical design for the Intelligent Learning Roadmap feature.  
**Constraint:** No implementation, no code modifications, no dependency installation.

**Revision history:**
| Rev | Date | Summary |
|---|---|---|
| R1 | 2026-11-09 | Initial design incorporating approved decisions |
| R2 | 2026-11-09 | Decisions D1–D12 fully incorporated |
| R3 | 2026-11-10 | Complete rewrite with all prior decisions applied |
| R4 | 2026-11-10 | Technical audit: 8 correctness fixes applied (see §18) |

---

## Table of Contents

1. [Overview and Scope](#1-overview-and-scope)  
2. [Architecture Summary](#2-architecture-summary)  
3. [MongoDB Schemas and Indexes](#3-mongodb-schemas-and-indexes)  
4. [Idempotent Activity Persistence](#4-idempotent-activity-persistence)  
5. [Project Transition Rules](#5-project-transition-rules)  
6. [Bounded Activity Storage](#6-bounded-activity-storage)  
7. [Timezone-Aware Streak Algorithms](#7-timezone-aware-streak-algorithms)  
8. [User-Controlled Roadmap Starting Level](#8-user-controlled-roadmap-starting-level)  
9. [API Contracts](#9-api-contracts)  
10. [Frontend Behavior](#10-frontend-behavior)  
11. [Learning Streak Tracker Design](#11-learning-streak-tracker-design)  
12. [Zero-Cost Assessment](#12-zero-cost-assessment)  
13. [Migration and Backward Compatibility](#13-migration-and-backward-compatibility)  
14. [File-by-File Implementation Plan](#14-file-by-file-implementation-plan)  
15. [Test Plan](#15-test-plan)  
16. [Remaining Risks and Trade-offs](#16-remaining-risks-and-trade-offs)  
17. [Unresolved Technical Decisions](#17-unresolved-technical-decisions)  
18. [Audit Log — R3 → R4 Corrections](#18-audit-log--r3--r4-corrections)

---

## 1. Overview and Scope

### 1.1 Feature Summary

The Intelligent Learning Roadmap adds a structured, personalized learning layer on top of NEXUS's existing deterministic skill-gap analysis. It is a natural extension of the existing `DevelopmentPage` — not a separate product.

The feature has four independent sub-systems that share data but have no mandatory dependencies on one another:

| Sub-system | Purpose |
|---|---|
| **Roadmap templates** | Curated multi-stage learning plans per target role |
| **Activity tracking** | Records when and how much the user learned each day |
| **Learning Streak Tracker** | Compact UI: 105-day heatmap, current streak, longest streak |
| **Starting level selection** | User declares familiarity level; roadmap adapts without altering verified scores |

### 1.2 Decisions Applied

| # | Decision |
|---|---|
| D1 | Heatmap period: fixed 15 weeks (105 days) |
| D2 | Activity intensity: 0 = none, 1 = one event, 2 = 2–4 events, 3 = 5+ events |
| D3 | Streak grace period: none — a missed day ends the streak |
| D4 | Explicit learning log: one-tap, no mandatory note |
| D5 | Regeneration banner: dismissible, shows preserved completed-task count |
| D6 | Idempotent activity recording via stable event identifiers |
| D7 | Project activity only on genuine state transitions |
| D8 | Bounded `events` array — no unbounded document growth |
| D9 | Timezone: user's declared timezone; no silent rewriting of historical dates |
| D10 | GitHub score acknowledges technical experience; does not imply mastery |
| D11 | Curated templates always work without an LLM |
| D12 | NEXUS must remain fully functional at ₹0 additional monthly cost |

### 1.3 What This Design Does NOT Change

- Separate `learning_roadmaps` and `learning_activity` MongoDB collections.
- Independent roadmaps per target role.
- Persistent checklist and project progress.
- Five status-based guidance experiences (not_started, planned, in_progress, completed, skipped).
- Curated resource catalog.
- Optional LLM enhancement (never mandatory).
- Compact NEXUS-styled Learning Streak Tracker.
- 105-day activity heatmap.
- Current and longest streak statistics.
- Explicit learning log action.
- Separation between self-reported learning and verified GitHub evidence.
- Existing deterministic scoring pipeline (untouched).

---

## 2. Architecture Summary

### 2.1 System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (apps/web)                                        │
│  ├── DevelopmentPage.tsx   (existing — extended)            │
│  ├── LearningStreakTracker.tsx   (new compact component)     │
│  ├── StartingLevelSelector.tsx  (new inline UI)             │
│  └── RoadmapView.tsx   (new — renders roadmap + projects)   │
├─────────────────────────────────────────────────────────────┤
│  API (apps/api)                                             │
│  ├── routes/learning.routes.ts   (new)                      │
│  ├── controllers/learning.controller.ts   (new)             │
│  ├── services/learning-roadmap.service.ts   (new)           │
│  ├── services/learning-activity.service.ts  (new)           │
│  └── services/learning-streak.service.ts   (new)            │
├─────────────────────────────────────────────────────────────┤
│  Data (MongoDB)                                             │
│  ├── learning_roadmaps collection   (new)                   │
│  └── learning_activity collection   (new)                   │
├─────────────────────────────────────────────────────────────┤
│  Config / Templates                                         │
│  └── config/learning-templates.json   (new — curated data) │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Separation of Concerns

| Concern | Location | Note |
|---|---|---|
| Skill scores | `packages/domain/src/scoring/` | READ ONLY — never written by this feature |
| Role benchmarks | `config/roles.json` | READ ONLY |
| Gap analysis | `apps/api/src/career/transition/` | READ ONLY — roadmap consumes gap results |
| Roadmap progress | `learning_roadmaps` collection | Owned by this feature |
| Activity records | `learning_activity` collection | Owned by this feature |
| LLM calls | Optional path in `learning-roadmap.service.ts` | Falls back to templates |

### 2.3 Five Status-Based Guidance Experiences

| Status | Guidance shown |
|---|---|
| `not_started` | Resource list + "Start here" prompt |
| `planned` | Timeline prompt |
| `in_progress` | Active encouragement + tips |
| `completed` | Verification reminder ("push to GitHub") |
| `skipped` | Task de-emphasized but preserved |

---

## 3. MongoDB Schemas and Indexes

### 3.1 `learning_roadmaps` Collection

One document per `(userId, targetRole)` pair.

```typescript
interface LearningRoadmapDocument {
  _id: ObjectId;
  userId: string;
  targetRole: string;
  startingLevel: "beginner" | "intermediate" | "advanced";
  startingLevelSetAt: Date;
  startingLevelSource: "user-declared";  // literal constant; never inferred

  // Checklist task progress. Key: stageId + ":" + taskId
  taskProgress: Map<string, {
    status: "not_started" | "planned" | "in_progress" | "completed" | "skipped";
    updatedAt: Date;
  }>;

  // Project progress. Key: projectId
  projectProgress: Map<string, {
    status: "not_started" | "in_progress" | "completed";
    startedAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
    // R4 FIX: stored here to avoid cross-document scans for reopen eventId construction
    reopenCount: number;  // incremented atomically on each completed→in_progress transition
  }>;

  // LLM-generated customization (optional)
  customization: {
    generatedAt: Date;
    preservedTaskIds: string[];
    source: "llm" | "template";
  } | null;

  // Set on regeneration; cleared atomically on first GET after regeneration
  regenerationBanner: { preservedCount: number } | null;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes for `learning_roadmaps`:**

```javascript
{ userId: 1, targetRole: 1 }   // unique: true
{ userId: 1, updatedAt: -1 }   // dashboard listing
```

### 3.2 `learning_activity` Collection

One document per `(userId, localDate)` pair. `localDate` is `YYYY-MM-DD` in the user's declared timezone at time of recording.

```typescript
interface LearningActivityDocument {
  _id: ObjectId;
  userId: string;
  localDate: string;      // "YYYY-MM-DD" — user's local calendar date at time of write
  timezone: string;       // IANA name used to compute localDate; never changed after write

  events: LearningEvent[];  // bounded — see §6

  // Derived from events; stored to avoid per-read computation.
  // Self-healed on next read if stale (§4.6).
  eventCount: number;
  intensity: 0 | 1 | 2 | 3;

  createdAt: Date;
  updatedAt: Date;
}

type LearningEvent =
  | ChecklistTaskEvent
  | ExplicitLogEvent
  | ProjectTransitionEvent
  | ArchivedSummary;        // replaces full events[] after 105-day window (§6.3)

interface ChecklistTaskEvent {
  type: "checklist_task";
  eventId: string;
  // NOTE: eventId does NOT include localDate. Idempotency is per-(userId, localDate)
  // document only. The same task completing on a different day creates a new event
  // in a different document — this is intentional (§4.2).
  roadmapId: string;
  stageId: string;
  taskId: string;
  recordedAt: Date;
}

interface ExplicitLogEvent {
  type: "explicit_log";
  eventId: string;   // includes localDate and seq; see §4.2
  seq: number;
  recordedAt: Date;
}

interface ProjectTransitionEvent {
  type: "project_transition";
  eventId: string;
  roadmapId: string;
  projectId: string;
  fromStatus: string;
  toStatus: "in_progress" | "completed";
  recordedAt: Date;
}

// Replaces events[] when document exits the 105-day hot window (§6.3)
interface ArchivedSummary {
  type: "archive_summary";
  eventId: string;             // sha256hex(userId + ":" + localDate + ":archive")
  originalEventCount: number;  // was stored in eventCount at time of archival
  archivedAt: Date;
}
```

**Indexes for `learning_activity`:**

```javascript
{ userId: 1, localDate: 1 }   // unique: true  — primary lookup + range scans
{ userId: 1, localDate: -1 }  // streak calculation (descending scan)
```

### 3.3 Schema Notes

- `localDate` string ordering (`"2026-11-01" < "2026-11-10"`) is correct for MongoDB range queries.
- `intensity` and `eventCount` are stored to allow heatmap reads without scanning `events`.
- Historical `timezone` values are **never changed** once written.
- `startingLevelSource` is always the literal string `"user-declared"` — the write path must enforce this. It is never derived from GitHub evidence or any other signal.

---

## 4. Idempotent Activity Persistence

### 4.1 Principle

Every meaningful learning action produces a **stable, deterministic event identifier** (`eventId`). Before any event is accepted, the service checks whether an event with the same `eventId` already exists in the current day's document. If it does, the request is acknowledged as a no-op.

This protects against:
- UI double-taps on the "Log Learning" button.
- Network retries of the same API request.
- Repeated calls to the task completion endpoint on the same day.
- Concurrent requests arriving in the same millisecond.

### 4.2 Event ID Construction

Each event type has a deterministic, collision-resistant derivation. Hash function: SHA-256 hex truncated to 32 characters.

| Event type | Input to hash | Idempotency scope |
|---|---|---|
| `checklist_task` | `userId + ":" + roadmapId + ":" + stageId + ":" + taskId + ":completed"` | One event per task per day-document. Same task on a different day = different document = new event (intentional). |
| `project_transition` to `in_progress` (first) | `userId + ":" + roadmapId + ":" + projectId + ":in_progress"` | One event per initial start |
| `project_transition` reopen | `userId + ":" + roadmapId + ":" + projectId + ":in_progress_reopen_" + reopenCount` | One event per reopen. `reopenCount` read from `learning_roadmaps.projectProgress[projectId].reopenCount` — **not** from scanning activity documents (R4 fix). |
| `project_transition` to `completed` | `userId + ":" + roadmapId + ":" + projectId + ":completed"` | One event per initial completion. Re-completion after reopen: use `":completed_" + completionCount` where `completionCount` is stored in `projectProgress`. |
| `explicit_log` (Nth session on a day) | `userId + ":" + localDate + ":log:" + seq` | One event per 30-min session. `seq` derived from count of existing `explicit_log` events in the current day's document at time of request. |
| `archive_summary` | `userId + ":" + localDate + ":archive"` | One per document, written once on archival |

**Example event IDs (illustrative):**
```
checklist_task:    sha256("u42:r9f:stage-1:task-react-hooks:completed")     → "3a1f9c8e..."
explicit_log(1):   sha256("u42:2026-11-10:log:1")                           → "7b2d4f1a..."
project_start:     sha256("u42:r9f:proj-todo-app:in_progress")               → "c5e8a3d2..."
project_reopen(1): sha256("u42:r9f:proj-todo-app:in_progress_reopen_1")      → "9f1b7c4e..."
project_complete:  sha256("u42:r9f:proj-todo-app:completed")                 → "2e6a8d3f..."
```

**Why `checklist_task` has no `localDate` in the hash:** Idempotency for checklist tasks is enforced per-(userId, localDate) document via the `$ne` guard on the events array. The same task completing on a different day will correctly create a new event in a different document. Including `localDate` would prevent a user from legitimately re-engaging with a task on a future day.

**`explicit_log` seq race:** Two concurrent explicit log requests that both see `seq = 1` will produce the same `eventId`. The `$ne` guard blocks the second insert atomically, returning no match. This is handled as a duplicate, not an error. See §4.3.

### 4.3 Concurrency-Safe MongoDB Write

**Two-phase write with `$ne` guard:**

```javascript
// Phase 1: optimistic read check (reduces load; not a hard guarantee)
const existing = await LearningActivity.findOne(
  { userId, localDate, "events.eventId": eventId },
  { _id: 1 }
);
if (existing) {
  return { accepted: false, reason: "duplicate" };
}

// Phase 2: atomic upsert with $ne guard
// The $ne guard on the array field is an atomic document-level check:
//   { "events.eventId": { $ne: eventId } } matches only when NO element
//   in events[] has the given eventId — this is correct MongoDB array semantics.
let updated;
try {
  updated = await LearningActivity.findOneAndUpdate(
    {
      userId,
      localDate,
      "events.eventId": { $ne: eventId },   // atomic guard
    },
    {
      $push: { events: newEvent },
      $inc: { eventCount: 1 },              // corrected in Phase 3
      $setOnInsert: { createdAt: now, timezone },
      $set: { updatedAt: now }
    },
    { upsert: true, new: true, runValidators: true }
  );
} catch (err) {
  if (err.code === 11000) {
    // E11000: Two concurrent requests raced to create the first document for
    // this (userId, localDate). The unique index rejected the second.
    // This means the first succeeded (or the event already existed).
    // Treat as duplicate — not an error.
    return { accepted: false, reason: "duplicate" };
  }
  throw err;
}

if (!updated) {
  // findOneAndUpdate returned null with upsert:true — this means the $ne
  // filter was not satisfied (event already exists in document).
  return { accepted: false, reason: "duplicate" };
}

// Phase 3: recalculate intensity from authoritative events.length
// Brief race window: a concurrent request that also succeeded in Phase 2
// may have added its own event between our Phase 2 and Phase 3. The last
// writer of eventCount wins. Self-healing read path (§4.6) corrects any
// inconsistency on the next read.
const finalCount = updated.events.length;
const intensity = computeIntensity(finalCount);
await LearningActivity.updateOne(
  { _id: updated._id },
  { $set: { eventCount: finalCount, intensity } }
);

return { accepted: true, localDate, intensity };
```

**`computeIntensity` logic:**
```javascript
function computeIntensity(count) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 4) return 2;
  return 3;
}
```

**E11000 handling note:** The E11000 (duplicate key) error arises when two concurrent requests both attempt to create the first `learning_activity` document for the same `(userId, localDate)`. Catching code `11000` and returning `accepted: false, reason: "duplicate"` is correct — one of the two requests succeeded; the other's event was not needed.

**Step 3 race window:** If two concurrent requests both pass Phase 2 for different events on the same day, their Phase 3 recalculations may race. The final stored `eventCount` may be briefly inaccurate. The `events` array is always correct. The self-healing read path in §4.6 corrects stale `eventCount` on the next read. This is an accepted, documented limitation.

### 4.4 Explicit Learning Log Policy

**Decision D4:** One-tap action. No mandatory note.

**Duplicate prevention:**
- **30-minute cooldown per session:** If fewer than 30 minutes have elapsed since the last `explicit_log` event on today's document, the new request is a duplicate. Returns `{ accepted: false, reason: "cooldown", retryAfterSeconds: N }`.
- **10-per-day cap:** The 10th accepted explicit log per day is the maximum. The 11th returns `{ accepted: false, reason: "daily_cap" }`.

**Seq computation under concurrency:**  
The `seq` for an `explicit_log` eventId is derived from the count of existing `explicit_log` events in today's document at the time of the Phase 1 read. If two concurrent requests both see `seq = 1`, they both compute the same `eventId`. The Phase 2 `$ne` guard atomically blocks one; the other receives `accepted: false`. The blocked request should not retry with a higher seq — it should return the cooldown or cap response as appropriate. The correct client behavior is: treat `accepted: false` on a log request as "already counted this session."

**Cooldown check:**
```javascript
const lastLog = document.events
  .filter(e => e.type === "explicit_log")
  .sort((a, b) => b.recordedAt - a.recordedAt)[0];

if (lastLog && (now - lastLog.recordedAt) < 30 * 60 * 1000) {
  const elapsed = now - lastLog.recordedAt;
  return {
    accepted: false,
    reason: "cooldown",
    retryAfterSeconds: Math.ceil((30 * 60 * 1000 - elapsed) / 1000)
  };
}
```

**UI implication:** After a successful log, the button shows "Logged ✓" and is suppressed for 30 minutes (client-side timer from `retryAfterSeconds`). No mandatory note field.

### 4.5 Checklist Task Completion Idempotency

When task status is set to `completed`:
1. The existing task status update in `learning_roadmaps` proceeds first.
2. The activity service checks for a duplicate `checklist_task` event in today's document.
3. If the event already exists: no-op for activity (roadmap update still proceeds).
4. If new: insert via §4.3.

Setting a task back from `completed` does NOT remove the activity event. Activity records are immutable.

**Re-completing the same task on a different day:** New event (different day-document, same eventId). This is intentional — the user genuinely re-engaged.

**Re-completing the same task on the same day:** Duplicate eventId, same document — blocked by `$ne` guard. Correct.

### 4.6 Partial Failure Reconciliation

If Phase 3 (intensity recalculation) fails after Phase 2 (insert) succeeds:
- `events` array is correct.
- `eventCount` and `intensity` may be stale.
- **Self-healing:** On the next read of this document, compare `eventCount` to `events.filter(e => e.type !== "archive_summary").length`. If they differ, recalculate and patch with a `findOneAndUpdate`. This requires no additional infrastructure.

---

## 5. Project Transition Rules

### 5.1 State Machine

```
              start
                │
                ▼
        ┌──────────────┐
        │  not_started │◄──────────────────────┐
        └──────┬───────┘                        │
               │ user begins                   │ reset
               ▼                                │
        ┌──────────────┐                        │
        │  in_progress │◄──────────────┐        │
        └──────┬───────┘               │        │
               │ user marks complete   │ reopen │
               ▼                       │        │
        ┌──────────────┐───────────────┘        │
        │  completed   │────────────────────────┘
        └──────────────┘
```

### 5.2 Allowed Transitions

| From | To | Activity event? | Notes |
|---|---|---|---|
| `not_started` | `in_progress` | Yes — `project_transition(toStatus: "in_progress")` | `startedAt` set |
| `in_progress` | `completed` | Yes — `project_transition(toStatus: "completed")` | `completedAt` set |
| `not_started` | `completed` | Yes — completion event only | `startedAt` and `completedAt` set |
| `completed` | `in_progress` | Yes — reopen event (see §5.3) | `completedAt` cleared |
| `completed` | `not_started` | No | Full reset; `startedAt` and `completedAt` cleared |
| `in_progress` | `not_started` | No | Abandon; `startedAt` cleared |
| Any → same | No | Idempotent no-op; returns 200 |

### 5.3 `completed → in_progress` Reopen Behavior

When a completed project is reopened:
- `completedAt` is set to `null`.
- `startedAt` retains its original value.
- `updatedAt` is refreshed.
- `projectProgress[projectId].reopenCount` is incremented atomically.
- A `project_transition` event is recorded with `toStatus: "in_progress"`.

**R4 FIX — reopen eventId:**  
The eventId uses `reopenCount` from `learning_roadmaps.projectProgress[projectId].reopenCount`, **not** from scanning `learning_activity` documents. The `reopenCount` is incremented atomically in the same `findOneAndUpdate` that updates the project status, making it a single atomic operation.

```javascript
// Atomic: update project status AND increment reopenCount in one operation
const updatedRoadmap = await LearningRoadmap.findOneAndUpdate(
  {
    userId,
    "targetRole": targetRole,
    [`projectProgress.${projectId}.status`]: "completed"  // fromStatus guard (R4 fix)
  },
  {
    $set: {
      [`projectProgress.${projectId}.status`]: "in_progress",
      [`projectProgress.${projectId}.completedAt`]: null,
      [`projectProgress.${projectId}.updatedAt`]: now,
      updatedAt: now
    },
    $inc: { [`projectProgress.${projectId}.reopenCount`]: 1 }
  },
  { new: true }
);

if (!updatedRoadmap) {
  // Document either doesn't exist or project is not in "completed" state.
  // The project was already in_progress (concurrent request won), or the
  // transition is invalid. Return no_change.
  return { accepted: false, reason: "no_change" };
}

const newReopenCount = updatedRoadmap.projectProgress.get(projectId).reopenCount;
const eventId = sha256hex(`${userId}:${roadmapId}:${projectId}:in_progress_reopen_${newReopenCount}`);
// ... record activity event
```

**Unresolved decision (U2):** Whether re-opening a project should decrement any summary completed-project count. See §17.

### 5.4 Idempotency for Repeated Requests

**R4 FIX — atomic `fromStatus` guard:**  
Instead of a read-then-write (which has a race window), all project status transitions use `findOneAndUpdate` with the expected current status in the filter:

```javascript
// The filter includes the expected fromStatus — if the status has already
// changed (concurrent request), the update finds no match and returns null.
const result = await LearningRoadmap.findOneAndUpdate(
  {
    userId,
    targetRole,
    [`projectProgress.${projectId}.status`]: fromStatus
  },
  { /* $set fields */ },
  { new: true }
);

if (!result) {
  // Status was not fromStatus — either already transitioned (concurrent request won)
  // or same as requested (no-op). Return no_change.
  return { accepted: false, reason: "no_change" };
}
```

This guarantees that activity events are only recorded when a genuine state transition occurs, with no race window between checking and writing.

### 5.5 Project Timestamps

| Field | Set when |
|---|---|
| `startedAt` | First transition to `in_progress` or direct to `completed` |
| `completedAt` | First transition to `completed` (or re-completion after reopen) |
| `updatedAt` | Every accepted status change |
| `reopenCount` | Incremented on each `completed → in_progress` transition |

If a project moves from `completed` back to `in_progress`, `completedAt` is cleared. If it completes again, `completedAt` is set to the new date. `startedAt` is preserved throughout.

---

## 6. Bounded Activity Storage

### 6.1 Problem

The `events` array inside each `learning_activity` document could grow over time if kept indefinitely.

### 6.2 Design: Two-Tier Retention

**Tier 1 — Hot window (last 105 days):**  
Full `events` array preserved. Required for heatmap display and idempotency checks.

**Tier 2 — Cold archive (older than 105 days):**  
Events array replaced by a compact `archive_summary`. Full event-level detail is not retained. `intensity`, `eventCount`, `localDate`, and `timezone` are preserved.

### 6.3 Summary Format for Cold Documents

```typescript
interface ArchivedSummary {
  type: "archive_summary";
  eventId: string;             // sha256hex(userId + ":" + localDate + ":archive")
  originalEventCount: number;  // value of eventCount at time of archival
  archivedAt: Date;
}
```

After archival:
- `events`: single `ArchivedSummary` element.
- `eventCount`: **unchanged** — preserves original count for historical display.
- `intensity`: **unchanged** — preserves original intensity for historical heatmap.
- `localDate` and `timezone`: **unchanged**.

### 6.4 Archival Trigger (R4 FIX)

**R3 had a design flaw:** The heatmap query fetches `localDate >= cutoffDate` (last 105 days). Documents outside the hot window are therefore never returned by the heatmap query and cannot be archived lazily by the heatmap fetch. This was a logical contradiction.

**R4 fix:** Archival is triggered lazily during the **streak calculation scan**, which fetches all `learning_activity` documents for a user ordered by `localDate`.

```
Streak calculation (§7.5 / §7.6)
  │
  ├── Fetch all documents: { userId }, sorted by localDate ASC
  │
  ├── For each document older than 105 days with events[] not yet archived:
  │     Archive it (replace events[] with ArchivedSummary) — batch max 20 per scan
  │
  └── Proceed with streak calculation using localDate values (archival does not
      affect streak — streak uses document presence, not events content)
```

**Why batch 20:** To avoid a latency spike on the first streak scan for a long-time user. Remaining un-archived documents are processed in subsequent streak scans.

**Heatmap fetch:** Only queries `localDate >= cutoffDate`. Archived documents (outside this window) are never fetched. No archival logic is needed in the heatmap handler.

**Cap on events within the hot window:**  
Each day's `events` array is capped at **50 events**. Writes beyond 50 are rejected with `{ accepted: false, reason: "daily_event_cap" }`.

### 6.5 Why Not a TTL Index?

A TTL index on `createdAt` would delete entire documents, destroying `intensity` and `eventCount` needed for historical display. The lazy-archival approach reduces document size while preserving display metadata. No additional infrastructure is required.

---

## 7. Timezone-Aware Streak Algorithms

### 7.1 Timezone Policy

Each activity record uses the user's **declared timezone at the time of recording**. This timezone is stored immutably in the `learning_activity` document.

Timezone resolution order:
1. User's declared timezone from profile.
2. `X-Timezone` request header.
3. UTC (fallback; response includes `timezoneWarning`).

**Historical records are never rewritten.** If a user changes their declared timezone, past records retain their original `timezone` and `localDate` values.

### 7.2 Activity Date Determination

```
Server receives activity request
  │
  ├── Resolve timezone (profile → header → UTC fallback)
  ├── Compute: localDate = formatInTimezone(now, timezone, "YYYY-MM-DD")
  └── Store { localDate, timezone } in learning_activity document (immutable)
```

`localDate` is stored as a canonical string. It is never re-derived from stored timestamps.

### 7.3 Handling Historical Timezone Changes

**What is preserved:** Past records retain their original `localDate` and `timezone` values. They are not modified.

**How the streak is calculated:** Streak logic uses only the sequence of `localDate` strings, not UTC timestamps. Consecutive `localDate` values (`"2026-11-09"` → `"2026-11-10"`) represent a streak regardless of which timezone generated each date.

**Acknowledged limitation (R4 correction):**  
The claim "a user active every calendar day will never have a streak broken by a timezone change" is **not universally true** and must not be presented as a guarantee.

Extreme timezone jumps can cause apparent `localDate` gaps. Example: a user active at 11 PM UTC-12 (Nov 9) travels immediately to UTC+14 (Nov 11 in that zone), skipping Nov 10 in the UTC+14 calendar. The gap in `localDate` values would break the streak even though the user was active every day subjectively.

**Correct behavior:** The streak is broken in this case. NEXUS does not rewrite historical dates or extend grace periods to compensate. Consistency and explainability take priority over artificially preserving streaks.

**UI copy that must NOT appear:**  
> "Timezone changes will never affect your streak."

**UI copy that is accurate:**  
> "Your streak is based on your local calendar days. Extreme timezone changes may create apparent gaps."

### 7.4 Daylight Saving Time Handling

DST transitions do not require special handling because:
- `localDate` is a calendar date string, not a timestamp.
- An IANA-aware library (`date-fns-tz` or `luxon`) handles DST-aware date conversion at recording time.
- "Fall back" transitions repeat an hour but always produce the same calendar date.
- "Spring forward" transitions skip an hour but the IANA library resolves to the same calendar date.

No special DST handling is required in the application logic.

### 7.5 Current Streak Calculation

```
Input:
  userId
  today = current local date in user's declared timezone

Algorithm:
  1. Fetch all documents for userId, ordered by localDate DESC.
  2. Set streak = 0, cursor = today.
  3. For each document:
     a. If document.localDate == cursor:
        streak += 1; cursor = cursor - 1 day (calendar subtraction).
     b. Else if document.localDate == yesterday AND cursor == today:
        // No activity today yet — start counting from yesterday.
        cursor = yesterday; continue (do NOT increment; next iteration handles it).
     c. Else:
        // Gap found — streak ends.
        break.
  4. Return streak.
```

**D3 — No grace period:** A missed calendar day ends the streak at step 3c. Activity is never fabricated or carried forward.

**Today vs. yesterday:** If the user has not yet logged today, the streak reflects consecutive days ending with yesterday. If the user has logged today, today is included. Both are natural behaviors requiring no special grace-day logic.

### 7.6 Longest Streak Calculation

```
Algorithm:
  1. Fetch all documents for userId, ordered by localDate ASC.
  2. Set longestStreak = 0, currentRun = 0, prevDate = null.
  3. For each document:
     a. If prevDate == null OR document.localDate == prevDate + 1 day:
        currentRun += 1; longestStreak = max(longestStreak, currentRun).
     b. Else:
        currentRun = 1.
     c. prevDate = document.localDate.
  4. Return longestStreak.
```

This scan uses `localDate` string values only. Archived documents (ArchivedSummary in events[]) are still included in the scan — their `localDate` is preserved, so streak calculation is unaffected by archival.

**Longest streak after archival:** Fully preserved. The scan operates on document existence (by `localDate`), not on `events` content. Archiving the `events` array does not remove the document or change its `localDate`.

**Performance:** One document per day of activity. At one record/day for 1,000 days = 1,000 documents. Acceptable as an in-memory scan. Caching longest streak in a summary document (see Risk §16.5) can be added later.

### 7.7 Missing Dates

If `localDate` documents are absent for a range, the streak calculation treats this as a break at step 3c. No special handling is needed.

### 7.8 Heatmap Date Range

The heatmap shows the **15 weeks (105 days) ending on the current local calendar date** in the user's declared timezone. The cutoff date is recomputed on every request and is not stored.

---

## 8. User-Controlled Roadmap Starting Level

### 8.1 Principle

GitHub evidence answers: "Has the user written code with this skill?"  
It does not answer: "Has the user learned this skill deeply enough to skip structured foundations?"

Starting level is **always user-declared** — never automatically inferred from GitHub scores or any other signal. The `startingLevelSource` field is always `"user-declared"` and is enforced at write time.

### 8.2 Three Starting Levels

| Level | Meaning | Default |
|---|---|---|
| `beginner` | Full roadmap from foundations | Yes — default for all new roadmaps |
| `intermediate` | Foundational stages de-emphasized | No |
| `advanced` | Foundational and core stages de-emphasized | No |

### 8.3 How GitHub Evidence Informs the UI

When displaying the starting level selector, NEXUS shows the user's GitHub-demonstrated skills as context:

> **Your GitHub evidence shows activity in: React · TypeScript · Node.js**  
> Choose your starting point. You can revisit any section at any time.  
>
> ○ Beginner — Full roadmap, start from foundations  
> ● Intermediate — Skip foundational topics (you can revisit them anytime)  
> ○ Advanced — Focus on specialized topics only  

**R4 clarification:** The evidence pills are populated from `alreadyDemonstrated` in the gap analysis response. If no gap analysis has been loaded for the current role, the evidence section is simply omitted — the selector is still shown with the three level choices. The selector must function correctly without gap analysis data.

GitHub evidence **informs** the user's choice; it never makes the choice.

### 8.4 What "Skip Familiar Topics" Means (R4 Clarification)

**"Skip familiar topics"** in the context of this feature means **de-emphasizing entire foundational stages**, not skipping individual tasks within any stage.

The roadmap stages in `config/learning-templates.json` carry a `level` tag: `"foundational"`, `"core"`, or `"advanced"`.

| Starting level | Stage display |
|---|---|
| `beginner` | All stages highlighted as active work |
| `intermediate` | `foundational` stages collapsed/de-emphasized; `core` and `advanced` highlighted |
| `advanced` | `foundational` and `core` stages collapsed; `advanced` highlighted |

**Collapsed** = visible and accessible but not highlighted as active work. The user can expand any collapsed stage and work on its tasks freely. No task or stage is hidden or deleted.

**Individual task skipping** is handled separately via the existing `skipped` task status — this is independent of starting level.

### 8.5 What Does NOT Change with Starting Level

- **Verified skill scores** — untouched. The scoring pipeline is not consulted by this feature.
- **Completed task progress** — preserved. Changing from `beginner` to `intermediate` leaves all completed foundational tasks marked as completed.
- **GitHub evidence display** — the `alreadyDemonstrated` section continues to show GitHub-verified skills. These are not promoted or demoted based on starting level.
- **config/scoring.json SHA** — unchanged. The hash guard in the existing test suite continues to pass.

### 8.6 Starting Level Change Behavior

- Changing starting level does NOT delete or modify any existing task or project progress.
- Changing starting level does NOT trigger roadmap regeneration.
- Changing starting level only affects which stage groups are highlighted versus collapsed.
- `startingLevelSetAt` is refreshed on every change.

### 8.7 Regeneration Banner (Decision D5)

```
┌─────────────────────────────────────────────────────── ✕ ┐
│ Your roadmap was updated. 7 completed tasks were         │
│ preserved exactly as you left them.                      │
└──────────────────────────────────────────────────────────┘
```

Banner is shown when `regenerationBanner` is non-null in the roadmap response. Dismissed client-side (React state). On the next `GET /api/learning/roadmap/:targetRole`, the server reads and returns the banner value then clears it atomically via `findOneAndUpdate` with `{ $unset: { regenerationBanner: 1 } }` and `returnDocument: "before"`.

---

## 9. API Contracts

### 9.1 Roadmap Endpoints

**GET /api/learning/roadmap/:targetRole**  
Returns or initializes roadmap. On first call, creates document with `startingLevel: "beginner"`.

Response:
```typescript
{
  roadmapId: string;
  targetRole: string;
  startingLevel: "beginner" | "intermediate" | "advanced";
  startingLevelSetAt: string;   // ISO-8601
  stages: RoadmapStage[];
  projectProgress: Record<string, ProjectProgressItem>;
  taskProgress: Record<string, TaskProgressItem>;
  customization: { generatedAt: string; preservedTaskIds: string[]; source: "llm" | "template" } | null;
  regenerationBanner: { preservedCount: number } | null;
}
```

**PUT /api/learning/roadmap/:targetRole/starting-level**  
Request: `{ startingLevel: "beginner" | "intermediate" | "advanced" }`  
Response: `{ startingLevel: string; startingLevelSetAt: string }`

**POST /api/learning/roadmap/:targetRole/tasks/:taskKey/complete**  
Marks task completed and records activity.  
Request: `{ timezone?: string }`  
Response:
```typescript
{
  taskKey: string;
  status: "completed";
  activityAccepted: boolean;
  activityReason?: "duplicate" | "daily_event_cap";
}
```

**PUT /api/learning/roadmap/:targetRole/tasks/:taskKey/status**  
Any status change (not just completed). Activity recorded only when status = `completed`.  
Request: `{ status: TaskStatus }`  
Response: `{ taskKey: string; status: TaskStatus; updatedAt: string }`

**PUT /api/learning/roadmap/:targetRole/projects/:projectId/status**  
Transitions project status per state machine (§5).  
Request: `{ status: "not_started" | "in_progress" | "completed"; timezone?: string }`  
Response:
```typescript
{
  projectId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  activityAccepted: boolean;
  activityReason?: "no_change" | "duplicate";
}
```

**POST /api/learning/roadmap/:targetRole/regenerate**  
LLM if available; template fallback always.  
Response:
```typescript
{
  source: "llm" | "template";
  preservedTaskCount: number;
  regeneratedAt: string;
}
```

### 9.2 Activity Endpoints

**POST /api/learning/activity/log**  
Request: `{ timezone?: string }`  
Response:
```typescript
{
  accepted: boolean;
  reason?: "duplicate" | "cooldown" | "daily_cap";
  retryAfterSeconds?: number;
  localDate: string;
  intensity: 0 | 1 | 2 | 3;
}
```

**GET /api/learning/activity/heatmap**  
Query: `timezone` (optional)  
Response:
```typescript
{
  days: Array<{ localDate: string; intensity: 0 | 1 | 2 | 3; eventCount: number }>;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  timezoneSource: "profile" | "request_header" | "utc_fallback";
  timezoneWarning?: string;
}
```

### 9.3 Streak Endpoints

**GET /api/learning/streak**  
Query: `timezone` (optional)  
Response:
```typescript
{
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  hasActivityToday: boolean;
  timezone: string;
  timezoneSource: "profile" | "request_header" | "utc_fallback";
}
```

### 9.4 HTTP Status Codes

| Scenario | Code |
|---|---|
| Write accepted | `200` |
| Idempotent duplicate / no-op | `200` with `accepted: false` |
| Validation error | `400` |
| Unauthenticated | `401` |
| Rate limited | `429` |
| Server error | `500` |

---

## 10. Frontend Behavior

### 10.1 DevelopmentPage Integration

The existing `DevelopmentPage` is extended, not replaced. All existing elements (`ProgressSummary`, `GapList`, `RefreshPanel`, direction selector) are unchanged.

New elements added:
1. `LearningStreakTracker` — compact tracker mounted above the direction selector.
2. `StartingLevelSelector` — inline control shown once a direction is selected and roadmap is loaded.
3. `RoadmapView` — renders stages, tasks, and projects for the selected role.
4. Regeneration banner — dismissible, shown after regeneration.

### 10.2 Starting Level Selection

Displayed once per roadmap load (or when user explicitly opens settings). Shows GitHub evidence pills only if gap analysis data is available:

```
[React] [TypeScript] [Node.js]   ← pills from alreadyDemonstrated (omitted if unavailable)

Starting point:
  ○ Beginner         (full roadmap — all topics)
  ● Intermediate     (skip foundational topics — revisit anytime)
  ○ Advanced         (skip foundational and core — focus on advanced)

Completed progress is always preserved when you change levels.
[Confirm]
```

`[Confirm]` calls `PUT /api/learning/roadmap/:targetRole/starting-level`.

### 10.3 Explicit Learning Log

```
  [+ Log Learning Today]
```

- `accepted: true` → "Logged ✓" for 30 minutes.
- `accepted: false, cooldown` → "Logged ✓ (session already counted)" with same timer.
- `accepted: false, daily_cap` → "Daily limit reached" until next day.
- Network error → inline error; button remains active for retry.

No mandatory note field.

### 10.4 Task Status Updates

Task completions in the roadmap view call `POST /api/learning/roadmap/:targetRole/tasks/:taskKey/complete`. The existing gap analysis task update route (`PUT /api/career/tasks/:skillId`) is not modified. The two routes serve different concerns: the career profile vs. the roadmap activity. The frontend calls them independently when in the roadmap view.

### 10.5 Project Status Updates

`PUT /api/learning/roadmap/:targetRole/projects/:projectId/status`. Atomic `fromStatus` guard (§5.4) ensures no duplicate events from rapid UI interactions.

### 10.6 Regeneration Banner

`regenerationBanner` non-null in roadmap response → show banner. Dismiss is client-side only. Server clears the field atomically on first fetch after regeneration.

---

## 11. Learning Streak Tracker Design

### 11.1 Component Overview

`LearningStreakTracker` is a compact, self-contained React component. Not a full-page redesign. Fits within the existing card-based layout.

### 11.2 Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                      Learning Activity                          │
│                                                                 │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ... 15 weeks × 7 days        │
│  │░░░░│  │    │  │░░░░│  │░░░░│                                 │
│  └────┘  └────┘  └────┘  └────┘                                 │
│  left = oldest, right = today                                   │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  12              │    │  34              │                  │
│  │  Current streak  │    │  Longest streak  │                  │
│  └──────────────────┘    └──────────────────┘                  │
│                                                                 │
│  Less ■ □ □ □ □ More                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Color Palette (R4 Correction — NEXUS Custom Theme)

**Important:** NEXUS remaps standard Tailwind color names to custom OKLCH values in `index.css`. The "indigo" scale in NEXUS is the **Deep Teal** scale, not standard purple-indigo. All heatmap color references must use the NEXUS OKLCH values, not standard Tailwind hex values.

| Intensity | Tailwind class | NEXUS OKLCH value | Description |
|---|---|---|---|
| 0 (no activity) | `bg-slate-100` | `oklch(90% 0.013 72)` | Cream tint — empty cell |
| 1 (one event) | `bg-indigo-200` | `oklch(76% 0.058 178)` | Light teal accent |
| 2 (2–4 events) | `bg-indigo-400` | `oklch(46% 0.075 190)` | Medium teal |
| 3 (5+ events) | `bg-indigo-600` | `oklch(33% 0.068 192)` | Strong teal |

Today's cell ring: `border-indigo-700` = `oklch(30% 0.065 192)` (Deep Teal primary — the NEXUS brand color).

**R4 fix:** The prior design referenced `#1E1B4B` (standard Tailwind indigo-950) for the today ring. In the NEXUS theme, `--color-indigo-950` = `oklch(98% 0.006 72)` (near-cream) — the opposite of a visible border. The correct today ring color is `indigo-700` (Deep Teal, `oklch(30% 0.065 192)`).

The heatmap will render in the NEXUS Deep Teal scale (teal greens) rather than standard GitHub-style purple-indigo. This is intentional and consistent with the NEXUS light theme.

### 11.4 Typography

- Component title: `font-display`, 14px, `text-slate-900`
- Stat numbers: `font-display`, 24px bold, `text-slate-900`
- Stat labels: 12px, `text-slate-500`
- Legend labels: 10px, `text-slate-400`

### 11.5 Accessibility

- Each cell: `aria-label="YYYY-MM-DD: N activities, Level K"`.
- Grid: `role="grid"` → rows `role="row"` → cells `role="gridcell"`.
- Stats: `<dl>` / `<dt>` / `<dd>`.
- indigo-600 on white: contrast ratio passes WCAG AA.

### 11.6 Data Loading

Parallel fetches on mount:
1. `GET /api/learning/activity/heatmap` — grid data.
2. `GET /api/learning/streak` — stat data.

Loading skeleton (grey cells), error state (inline, doesn't break page).

---

## 12. Zero-Cost Assessment

### 12.1 Non-Negotiable Requirements

1. Curated templates always work without an LLM.
2. No mandatory API key.
3. No mandatory LLM provider.
4. No paid API calls.
5. No automatic paid fallback.
6. LLM unavailable / exhausted / unconfigured → templates.
7. External free-tier quotas are NOT guaranteed.
8. No new infrastructure.
9. Fully functional at ₹0 additional monthly cost.

### 12.2 LLM Code Path

```
generateRoadmap(userId, targetRole, gapAnalysis)
  │
  ├── if (env.LLM_PROVIDER && env.LLM_API_KEY):
  │     try LLM customization
  │     catch (quota exhausted / unavailable / timeout / any error):
  │       log warning; fall through — do NOT surface error to user
  │
  └── return template roadmap (always works; no LLM required)
```

The template path is the **default path**, not a fallback. The LLM path is an optional enhancement. The service will never attempt a paid API call under any failure mode.

### 12.3 Template-Only Operation

Without an LLM:
- Full roadmap displayed with curated resources.
- Activity and streak tracking fully functional.
- Starting level selection fully functional.
- Explicit logging fully functional.

The LLM adds personalization to roadmap text only. No structural feature is gated on LLM availability.

### 12.4 Groq Free Tier Disclaimer

The Groq free tier (200K tokens/day) is not guaranteed:
- Groq may change limits at any time.
- Quota exhaustion → template path, automatically.
- **No paid call is ever made.** The operator configures the LLM provider; NEXUS never switches to a paid provider automatically.

### 12.5 Storage Impact

- `learning_activity`: ~500–2,000 bytes per active day per user (bounded by 50 events/day + archival).
- `learning_roadmaps`: ~5–20 KB per roadmap per user.
- MongoDB Atlas M0 (512 MB) accommodates thousands of users before this matters.

**Additional monthly cost: ₹0.**

---

## 13. Migration and Backward Compatibility

### 13.1 Existing Data

Two new collections are introduced. No existing collections are modified.

The existing `learning` field in the career profile document (`{ direction, tasks }`) is not changed and continues to serve the existing gap-analysis task tracking in `DevelopmentPage`.

### 13.2 Existing Task Status Updates

`PUT /api/career/tasks/:skillId` is not modified. Activity recording for roadmap task completions is an explicit, separate API call from the roadmap view.

### 13.3 Existing Test Suite

No existing tests change. All new code is additive. The existing hash guard on `config/scoring.json` and `config/roles.json` continues to pass unchanged.

### 13.4 New vs. Existing Users

Both encounter an empty `learning_roadmaps` on first use. The first `GET /api/learning/roadmap/:targetRole` creates the document with `startingLevel: "beginner"`. No migration needed.

### 13.5 Backward-Incompatible Changes

None.

---

## 14. File-by-File Implementation Plan

### 14.1 New Files — API

| File | Purpose |
|---|---|
| `apps/api/src/models/learning-roadmap.model.ts` | Mongoose model; includes `reopenCount` in `projectProgress` |
| `apps/api/src/models/learning-activity.model.ts` | Mongoose model; includes `ArchivedSummary` type |
| `apps/api/src/services/learning-roadmap.service.ts` | CRUD, starting level, regeneration, project transitions (atomic guard) |
| `apps/api/src/services/learning-activity.service.ts` | Idempotent write (Phase 1–3), archival, explicit log cooldown |
| `apps/api/src/services/learning-streak.service.ts` | Streak + heatmap; triggers archival scan |
| `apps/api/src/controllers/learning.controller.ts` | Express handlers |
| `apps/api/src/routes/learning.routes.ts` | Route definitions |

### 14.2 New Files — Config

| File | Purpose |
|---|---|
| `config/learning-templates.json` | Curated stages, tasks, projects, and resources per role |

### 14.3 New Files — Frontend

| File | Purpose |
|---|---|
| `apps/web/src/features/career/LearningStreakTracker.tsx` | Heatmap + streak stats (NEXUS Deep Teal colors) |
| `apps/web/src/features/career/StartingLevelSelector.tsx` | Level selection with optional evidence pills |
| `apps/web/src/features/career/RoadmapView.tsx` | Stage/task/project renderer |
| `apps/web/src/api/learning-types.ts` | TypeScript interfaces for all learning API responses |

### 14.4 Modified Files — API

| File | Change |
|---|---|
| `apps/api/src/server.ts` or route registration | Register `learning.routes.ts` |

### 14.5 Modified Files — Frontend

| File | Change |
|---|---|
| `apps/web/src/features/career/DevelopmentPage.tsx` | Mount `LearningStreakTracker`, `StartingLevelSelector`, `RoadmapView` |

### 14.6 New Files — Tests

| File | Purpose |
|---|---|
| `apps/api/tests/learning-activity.test.ts` | Idempotency, concurrency, archival, intensity, E11000 |
| `apps/api/tests/learning-roadmap.test.ts` | Roadmap CRUD, project transitions, atomic guard, reopenCount |
| `apps/api/tests/learning-streak.test.ts` | Streak algorithms, timezone, DST, archival trigger |
| `apps/web/src/features/career/learning-streak.test.tsx` | LearningStreakTracker render tests |

### 14.7 Implementation Order

1. MongoDB models (with `reopenCount` and `ArchivedSummary`)
2. `config/learning-templates.json` — minimum: five roles from `config/roles.json`
3. `learning-activity.service.ts` (Phases 1–3, E11000 handling, archival)
4. `learning-roadmap.service.ts` (atomic project guards, reopenCount)
5. `learning-streak.service.ts` (streak scan + archival trigger)
6. Controller and routes
7. Register routes in server
8. API tests
9. `learning-types.ts`
10. `LearningStreakTracker` (using NEXUS Deep Teal OKLCH colors)
11. `StartingLevelSelector` (graceful when gap analysis unavailable)
12. `RoadmapView`
13. `DevelopmentPage` integration
14. Frontend tests

---

## 15. Test Plan

### 15.1 Activity Idempotency Tests

| Test | Expected |
|---|---|
| Task completed once | Event created |
| Same task completed again (same day) | `accepted: false, reason: "duplicate"` |
| Same task completed next day | New event in new document |
| Explicit log, first tap | Accepted |
| Explicit log, second tap within 30 min | `cooldown` |
| Explicit log, second tap after 30 min | Accepted (new seq) |
| Explicit log, 11th tap (with 30-min gaps) | `daily_cap` |
| Project start event twice (second while in_progress) | `no_change` |
| Task complete same day, re-complete same day | Duplicate blocked |

### 15.2 Concurrent Activity Write Tests

| Test | Expected |
|---|---|
| Two simultaneous requests for same event | Exactly one accepted; E11000 caught on second |
| Two concurrent task completions (same task, same day) | Exactly one event inserted |
| Concurrent requests for different events (same day) | Both accepted |
| Concurrent upsert for new day (first activity) | Exactly one document created; E11000 handled |
| Concurrent explicit log requests (both see seq=1) | One accepted; one duplicate |
| Step 3 stale eventCount self-heal | eventCount corrected on next read |

### 15.3 Project Transition Tests

| Test | Transition | Expected |
|---|---|---|
| Valid start | not_started → in_progress | startedAt set; event recorded |
| Valid complete | in_progress → completed | completedAt set; event recorded |
| Direct complete | not_started → completed | Both timestamps set; completion event only |
| Reopen | completed → in_progress | completedAt cleared; reopen event; reopenCount=1 in roadmap |
| Second reopen | in_progress → completed → in_progress | reopenCount=2; correct eventId |
| Reset | completed → not_started | Both cleared; no event |
| Abandon | in_progress → not_started | startedAt cleared; no event |
| No-op (same status) | completed → completed | No change; no event; `no_change` |
| Concurrent transition race | Two requests both see `completed` | Atomic `fromStatus` guard: one succeeds, one `no_change` |
| reopenCount in roadmap document after reopen | | reopenCount incremented in projectProgress |

### 15.4 Intensity Recalculation Tests

| eventCount | Expected intensity |
|---|---|
| 0 | 0 |
| 1 | 1 |
| 2 | 2 |
| 4 | 2 |
| 5 | 3 |
| 50 | 3 |
| Stale eventCount=4 but events.length=3 | Self-healed to 3; intensity=2 |

### 15.5 Bounded Storage Tests

| Test | Expected |
|---|---|
| 50 events accepted; 51st rejected | `daily_event_cap` |
| Streak scan archives documents older than 105 days (batch 20) | events[] = ArchivedSummary; intensity/eventCount preserved |
| Heatmap after archival | Historical bars displayed correctly from stored intensity |
| Longest streak after archival | Unchanged — localDate preserved on archived docs |
| Archival does NOT trigger from heatmap fetch | Archival only during streak scan |
| Heatmap fetch only returns last 105 days | Documents outside window not fetched |

### 15.6 Timezone and Streak Tests

| Test | Expected |
|---|---|
| Activity at 23:50 IST | localDate = that day in IST |
| Activity at midnight UTC (11:30 PM local) | localDate = previous day in local tz |
| Streak broken by one missing day | currentStreak resets; longestStreak preserved |
| Timezone change — past records | Past documents: timezone field unchanged |
| Timezone change — new records | New document: new timezone stored |
| Extreme timezone change (UTC-12 → UTC+14) | Apparent gap possible; streak broken — documented limitation |
| DST "spring forward" | Same calendar date; no error |
| DST "fall back" | Same calendar date either way |
| No activity today, activity yesterday | currentStreak reflects yesterday's run; not 0 |
| 60-day gap | currentStreak = 0; longestStreak = historical max |
| Historical activity localDate unchanged after timezone change | Existing documents not modified |
| UI does NOT claim timezone changes never affect streaks | Copy review |

### 15.7 Starting Level Tests

| Test | Expected |
|---|---|
| New roadmap default | `beginner` |
| Set to `intermediate` | Stored; task progress preserved |
| Completed tasks on `beginner`, change to `intermediate` | Completed tasks remain completed |
| GitHub score > 0 | Starting level NOT auto-set |
| GitHub score > 0 | Evidence displayed in UI only (pills) |
| Verified skill scores after starting level change | Identical to before |
| Advanced starting level | Foundational/core stages visible (collapsed), not hidden |
| Gap analysis unavailable | Evidence pills omitted; selector still functional |
| startingLevelSource field | Always "user-declared"; server validates |

### 15.8 LLM and Template Tests

| Test | Expected |
|---|---|
| No LLM configured | Template roadmap; no error |
| LLM quota exhausted | Template roadmap; warning logged; no error to client |
| LLM timeout | Template roadmap; no error to client |
| Template-only: streak/heatmap/tasks/projects | All fully functional |
| Regenerate with LLM unavailable | Template used; banner shows preserved count |
| LLM throws unexpected error | Template fallback; error not surfaced to user |

### 15.9 Independence of Learning Activity from Skill Scores

| Test | Expected |
|---|---|
| Complete 10 checklist tasks | `analyses` collection unchanged |
| Record 30 days of explicit learning | GitHub evidence analysis result unchanged |
| Set starting level to `advanced` | `config/scoring.json` SHA unchanged |
| Regenerate roadmap | `config/roles.json` SHA unchanged |

### 15.10 Regression

All 659 existing tests pass without modification.

---

## 16. Remaining Risks and Trade-offs

### 16.1 Lazy Archival Latency (streak scan)

The archival of documents older than 105 days is batched at 20 per streak scan. For a user with years of history, early scans will process older batches, with each scan processing up to 20 more. This is a mild latency overhead on streak calculation until all old documents are archived.

**Severity:** LOW — only affects long-time users; overhead per scan is small.

### 16.2 E11000 Concurrent Upsert

Two concurrent requests for the first activity of a new day both attempt to create the document. One succeeds; the other receives E11000. This is handled gracefully as a duplicate. The event is not lost.

**Severity:** LOW — standard MongoDB upsert pattern; well-understood.

### 16.3 Step 3 Intensity Race

If two requests insert different events on the same day concurrently, their Step 3 recalculations may race. The `eventCount` and `intensity` stored fields may be briefly stale. The `events` array is always correct. Self-healed on the next read.

**Severity:** LOW — brief transient inconsistency; correct on next read.

### 16.4 Template Coverage

`config/learning-templates.json` must cover every role in `config/roles.json`. An uncovered role returns an empty roadmap, which appears broken to the user.

**Mitigation:** Implement a fallback minimal roadmap from gap analysis output when no template exists for the role.

**Severity:** MEDIUM before minimum template coverage is established.

### 16.5 Longest Streak Scan Performance

The longest streak scan scans all activity documents for a user. At multi-year timescales (3,650+ documents), this may become noticeable. A cached `longestStreak` counter field can be added later.

**Severity:** LOW — only relevant at multi-year timescales.

### 16.6 Timezone Apparent Gaps

Extreme timezone changes (crossing the international date line) can create apparent `localDate` gaps that break streaks even when the user was active every day subjectively. This is documented as a known limitation, not a bug. The UI copy must reflect this honestly.

**Severity:** LOW — only affects users who cross extreme timezone boundaries.

### 16.7 Heatmap Color Integration with shadcn (Point 6 Consideration)

The NEXUS custom `@theme` in `index.css` remaps Tailwind's color names to OKLCH values. The heatmap uses Tailwind classes (`bg-indigo-200`, `bg-indigo-400`, etc.) which resolve to NEXUS Deep Teal colors. This is visually correct for NEXUS.

When Point 6 adds shadcn components, those components will use `bg-primary`, `bg-card`, etc. based on shadcn CSS variables (`--primary`, `--card`, etc.) which are not yet defined in `index.css`. Shadcn's CSS variable injection step during component installation must be coordinated with the existing custom `@theme` to avoid conflicts.

**Severity:** LOW for Point 5 (no shadcn components used in this feature). Relevant for Point 6 planning.

---

## 17. Unresolved Technical Decisions

| # | Question | Recommendation |
|---|---|---|
| U1 | MongoDB Atlas version ≥4.2? | Confirm before choosing between two-phase write (§4.3) and single-step aggregation pipeline update. Both produce correct results. |
| U2 | `completed → in_progress` reopen: decrement summary completed-project count? | Recommendation: derive from live `projectProgress` statuses, never from cached counters. No decision needed to begin implementation. |
| U3 | Minimum template coverage order | Recommend covering the five roles in `config/roles.json` as first deliverable. |
| U4 | Optional note field for explicit log | Explicitly deferred. Not in initial implementation scope. |

---

## 18. Audit Log — R3 → R4 Corrections

The following specific corrections were applied during the technical audit:

| # | Section | Issue in R3 | Correction in R4 |
|---|---|---|---|
| A1 | §3.1 Schema | `projectProgress` map had no `reopenCount` field | Added `reopenCount: number` to `projectProgress` entries |
| A2 | §4.2 Event IDs | `reopen_N` derived from scanning activity documents across multiple dates | Fixed: `reopenCount` stored in `learning_roadmaps.projectProgress`, read atomically in same update |
| A3 | §4.3 Write path | E11000 error not handled | Added explicit E11000 catch; return `accepted: false, reason: "duplicate"` |
| A4 | §4.3 Write path | Step 3 race window underdocumented | Added clear note: brief race exists; self-healed on next read; accepted limitation |
| A5 | §5.3–5.4 Transitions | Project status checked in read-then-write; race window possible | Fixed: `findOneAndUpdate` with `fromStatus` in filter — atomic guard, no race |
| A6 | §6.4 Archival trigger | Heatmap query fetches `localDate >= cutoff` but archival targets `localDate < cutoff` — logical contradiction | Fixed: archival triggered during streak scan (which fetches all documents), not heatmap fetch |
| A7 | §7.3 Timezone | "Consistency guarantee: unbroken streak regardless of timezone changes" | Removed false guarantee; added honest limitation caveat; specified correct UI copy |
| A8 | §8.3 / §8.4 Starting levels | "Skip familiar topics" ambiguous (stage vs. task level) | Clarified: "skip familiar topics" = de-emphasize foundational stages; individual tasks use `skipped` status separately; added graceful handling when gap analysis unavailable |
| A9 | §11.3 Colors | Heatmap referenced standard Tailwind hex values (#C7D2FE etc.) and standard indigo-950 (#1E1B4B) for today ring | Fixed: all colors now reference NEXUS OKLCH values; today ring changed from indigo-950 (near-cream in NEXUS) to indigo-700 (Deep Teal) |

---

## Appendix A — Intensity Level Reference

| Level | Condition | NEXUS color (Tailwind class → OKLCH) |
|---|---|---|
| 0 | 0 events | `bg-slate-100` → `oklch(90% 0.013 72)` |
| 1 | exactly 1 event | `bg-indigo-200` → `oklch(76% 0.058 178)` |
| 2 | 2–4 events | `bg-indigo-400` → `oklch(46% 0.075 190)` |
| 3 | 5 or more events | `bg-indigo-600` → `oklch(33% 0.068 192)` |
| Today ring | — | `border-indigo-700` → `oklch(30% 0.065 192)` (Deep Teal primary) |

---

## Appendix B — Event ID Derivation Reference (Updated R4)

| Event type | Stable inputs | Uniqueness guarantee |
|---|---|---|
| `checklist_task` completed | userId + roadmapId + stageId + taskId + ":completed" | One per task per day-document (not date-bound; same task on different days = new event in new document) |
| `project_transition` to `in_progress` | userId + roadmapId + projectId + ":in_progress" | One per initial start |
| `project_transition` reopen N | userId + roadmapId + projectId + ":in_progress_reopen_N" | N from `learning_roadmaps.projectProgress[id].reopenCount` |
| `project_transition` to `completed` | userId + roadmapId + projectId + ":completed" | One per initial completion |
| `project_transition` re-complete N | userId + roadmapId + projectId + ":completed_N" | N from `learning_roadmaps.projectProgress[id].completionCount` |
| `explicit_log` N | userId + localDate + ":log:" + N | N = count of existing explicit_log events on current day |
| `archive_summary` | userId + localDate + ":archive" | One per document, written once |

---

**Document status: DESIGN COMPLETE — Revision 4 — awaiting implementation approval.**  
**No code, tests, configuration files, or dependencies have been modified.**
