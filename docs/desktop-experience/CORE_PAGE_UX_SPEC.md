# Core Page UX Specification

Status: Proposed for Phase 1D  
Last updated: 2026-11-23

## 1. Shared page contract

Every core page contains:

1. Page title and short user-facing purpose.
2. Current state.
3. One primary action.
4. Visible operation result.
5. Failure recovery.
6. A recommended next step.

Shared structure:

```text
Page header
Context/status
Primary workspace
Secondary detail/history
Result or recovery message
Next-step link
```

## 2. Memory

### User flow

```text
Candidate queue → Source/details → Edit → Confirm or reject → Lifecycle result
```

### Requirements

- Candidate is the default queue.
- Show source agent, subject, timestamps, visibility and AI access before action.
- Editing never changes the source record silently.
- Confirm and Reject are visually and semantically distinct.
- Confirmation requires the current revision.
- After action, keep the result visible and offer Timeline or Profile as the next step.

### Empty/recovery

- No candidates: explain that new information waits here before entering Profile.
- Conflict: preserve the edited draft and require refresh/review.
- Save failure: keep content and retry.

## 3. Profile

### User flow

```text
Browse confirmed profile → Select category → Inspect source/access → Edit, supersede or delete → Review result
```

### Requirements

- Display confirmed, permitted content only.
- Group information using existing Profile sections.
- Show access/visibility in plain language.
- Editing creates the correct audited lifecycle change; it does not bypass confirmation.
- Deletion/forgetting explains whether content is archived or removed.
- Empty Profile points to onboarding or Memory Review.

## 4. Reflection

### User flow

```text
Start monthly reflection → Record dimensions/events/goals → Save draft → Review summary → Confirm → View history/trend
```

### Requirements

- Draft and confirmed states are always visible.
- Unsaved-change protection covers navigation and window close.
- Revision conflicts do not overwrite newer data.
- Confirmation is a separate final action.
- Trend uses confirmed reflections only.
- After confirmation, suggest Growth or the next monthly period.

## 5. Growth

### User flow

```text
View confirmed dimensions → Record user-authored change → Confirm assessment → Review history/relationships
```

### Requirements

- Never invent a growth score.
- Distinguish user-authored records from derived visual summaries.
- Empty state directs the user to Reflection or a new self-assessment.
- Historical views preserve source month and confirmation status.

## 6. Privacy

### User flow

```text
Review authorised clients → Inspect permissions → Review audit events → Change permissions or revoke
```

### Requirements

- Client identity, authorisation status and granted permissions are visible.
- Permission descriptions use user language with the exact scope available as secondary detail.
- Revocation explains immediate effects and preserves audit history.
- Audit integrity failure is never displayed as healthy.
- Next step links to AI Connections when setup changes are needed.

## 7. Backup

### User flow

```text
Inspect local backup state → Create snapshot → Verify → Optional GitHub backup → Guided restore
```

### Requirements

- Local snapshot is presented before optional GitHub backup.
- Every backup displays verification state.
- Restore follows Select → Verify → Confirm → Complete.
- The product explains that GitHub is a copy, not the source of truth.
- Destructive restore requires expected revision and confirmation text.
- Failure preserves diagnostic evidence and a safe recovery path.

## 8. AI Connections

### User flow

```text
View client/provider → Register → Authorise minimum permissions → Use → Review access → Rotate or revoke
```

### Requirements

- Separate external client authorisation from model Provider configuration.
- Credentials are shown only when existing security rules permit.
- Default permissions are minimal.
- Actual access is linked to Privacy audit records.
- Revoked clients remain auditable.
- Provider calls retain per-call content approval.

## 9. Settings

Settings contains:

- language and contrast;
- current personal-space summary;
- concept guide;
- links to Backup, Privacy and Connections;
- version and runtime information.

Settings must not become a second navigation dashboard.

## 10. Shared visual components

- PageHeader
- PrimaryAction
- StatusSummary
- EmptyState
- ErrorState
- LoadingState/Skeleton
- SuccessNotice
- ConflictNotice
- ConfirmDialog
- DetailInspector
- ActivityList
- HubTabs

## 11. Cross-page continuity

- Onboarding Candidate links to Memory.
- Memory confirmation updates Profile.
- Reflection confirmation feeds Growth trends.
- Connections actions link to Privacy audit.
- Backup and restore results return to Overview/System Health.
- Every page preserves the same shell, focus behaviour and state vocabulary.
