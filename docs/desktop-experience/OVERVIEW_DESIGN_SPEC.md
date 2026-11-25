# Overview Design Specification

Status: Proposed for Phase 1C  
Last updated: 2026-11-23

## 1. Purpose

Overview is the decision surface of the workspace. It answers:

1. What is the state of my personal profile?
2. Which memories need my review?
3. What changed recently?
4. Is my local data and access state healthy?
5. What should I do next?

It does not reproduce every feature page.

## 2. Low-fidelity desktop layout

```text
┌───────────────┬────────────────────────────────────────────────────┐
│ NEXORA        │ Good morning                          My Local Space │
│               │ Your personal AI workspace is stored on this device│
│ WORKSPACE     ├────────────────────────────────────────────────────┤
│ Overview      │ NEXT BEST ACTION                                   │
│ Memory     3  │ Review 3 candidate memories              Review →  │
│ Profile       ├──────────────────────────┬─────────────────────────┤
│ Reflection    │ MEMORY OVERVIEW          │ PERSONAL PROFILE        │
│ Growth        │ Candidate          3     │ 2 of 4 topics confirmed│
│               │ Awaiting review    3     │ 1 awaiting review      │
│ SYSTEM        │ Confirmed         18     │ View profile →          │
│ Privacy       ├──────────────────────────┴─────────────────────────┤
│ Backup        │ RECENT ACTIVITY                                   │
│ AI Connections│ • Candidate created · 12 min                      │
│               │ • Profile updated · Yesterday                     │
│               ├────────────────────────────────────────────────────┤
│ Settings      │ SYSTEM HEALTH                                      │
│               │ Local service ✓  Vault ✓  Backup !  Connections 2 │
└───────────────┴────────────────────────────────────────────────────┘
```

## 3. Mobile layout

```text
┌──────────────────────────┐
│ ☰  Overview   Local ✓    │
├──────────────────────────┤
│ Good morning             │
│ My Local Space           │
├──────────────────────────┤
│ NEXT ACTION              │
│ Review 3 memories     →  │
├──────────────────────────┤
│ MEMORY                   │
│ 3 candidate · 18 confirmed│
├──────────────────────────┤
│ PROFILE                  │
│ 2 of 4 topics confirmed  │
├──────────────────────────┤
│ RECENT ACTIVITY          │
├──────────────────────────┤
│ SYSTEM HEALTH            │
└──────────────────────────┘
```

## 4. Section specifications

### 4.1 Welcome

- Time-aware greeting without inferring the user's name.
- Current Vault display name.
- One sentence: data is stored locally and official memory is user-confirmed.
- No concept map, integration taxonomy or technical status list.

### 4.2 Next Best Action

Only one primary recommendation is shown.

Priority:

1. External Vault change requires review.
2. Candidate memories await review.
3. Onboarding profile topics remain available.
4. No confirmed memory exists.
5. No reflection exists for the current month.
6. No backup exists, no backup has verified successfully, verification is older than 30 days, or the latest backup operation failed.
7. Review confirmed profile.

The action includes a reason, a single button and no competing CTA.

### 4.3 Memory Overview

Display real values from the memory statistics API:

- Candidate memories.
- Pending review.
- Confirmed memories.

Counts link to Memory with the corresponding filter where supported. Values must not be estimated.

### 4.4 Personal Profile

- Confirmed topic progress from onboarding status where available.
- Number of candidates waiting for confirmation.
- Up to three confirmed profile summary lines that are allowed to display.
- Do not display candidate content as profile information.
- “Completeness” is a labelled topic count, not an inferred percentage.

### 4.5 Recent Activity

Phase 1C shows up to five real events from **Memory Timeline only**:

- candidate created or edited;
- memory confirmed, rejected or archived;
- source and timestamp where already exposed.

The section is labelled as memory activity. Profile, Reflection, Backup and permission events are not synthesised from unrelated APIs. They may be added only after a unified activity contract exists.

### 4.6 System Health

Compact, factual status:

| Item | Source | Good state | Attention state |
|---|---|---|---|
| Local service | health/runtime | Connected | Reconnecting/unavailable |
| Vault | Vault status | Ready | Missing, external change, inaccessible |
| Backup | backup overview | Last successful verification within 30 days | Never backed up, never verified, verification older than 30 days, or failed |
| AI Connections | security/client state | Authorised count | Revoked/denied activity where available |

Do not calculate a security score or claim “secure” solely from successful loading.
GitHub connection is not evidence that a backup exists or has verified successfully.

## 5. Data loading

Overview uses independent section state rather than converting errors to empty arrays.

```text
Page shell
  ├─ overview snapshot: required
  ├─ memory timeline: independent
  ├─ Vault status: independent
  ├─ onboarding state: independent
  └─ backup overview: independent
```

Use `Promise.allSettled` or equivalent per-section handling. A timeline failure must display “Recent activity unavailable”, not “No recent activity”.

## 6. State design

- Loading: stable skeleton with final layout dimensions.
- Empty: explanation plus one contextual action.
- Error: reason, retry and fallback destination.
- Success: inline confirmation without changing layout unexpectedly.
- Stale/external change: persistent warning until reviewed or dismissed.

## 7. Visual hierarchy

- Welcome uses open space, not a large card.
- Next Action is the only high-emphasis surface.
- Memory and Profile form the primary two-column pair.
- Recent Activity is a list, not a grid of cards.
- System Health is a compact status row.
- Electric Cyan is reserved for the main action and focus.
- Violet is ambient brand support.

## 8. Accessibility

- One page-level `h1`; section headings follow in order.
- Counts include visible labels and accessible names.
- Status does not rely on colour.
- Lists use semantic list markup.
- At 200% zoom the two-column area collapses without horizontal scrolling.
- Updated content uses restrained live-region announcements.

## 9. Acceptance criteria

- All displayed values come from current APIs.
- Candidate and confirmed counts remain distinct.
- Exactly one Next Best Action is visually primary.
- Partial API failures are distinguishable from empty data.
- Layout works at 1440px, 1024px and 390px.
- The page has no fixed duplicate status sidebar.
