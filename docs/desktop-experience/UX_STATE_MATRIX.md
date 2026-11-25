# UX State Matrix

Status: Proposed  
Last updated: 2026-11-23

## 1. Shared state vocabulary

| State | Meaning | Required UI |
|---|---|---|
| Loading | A real request is pending | Stable skeleton/progress and disabled duplicate action |
| Empty | Request succeeded with no records | Explanation, why it matters, next action |
| Ready | Data is current and usable | Primary action and relevant status |
| Saving | Mutation is in progress | Button progress, retained context, no duplicate submit |
| Success | Mutation completed | Result, what changed, next step |
| Error | Request or mutation failed | Plain-language reason, retry and fallback |
| Conflict | Revision changed elsewhere | Preserve draft, refresh and compare |
| Offline/local service unavailable | UI cannot reach local API | Reconnect/retry and diagnostics |
| External change | Vault changed outside NEXORA | Persistent review warning |
| Protected | Policy prevents display/action | Explain boundary without exposing data |

## 2. Page matrix

| Surface | Loading | Empty | Error/recovery | Success | Conflict/protected |
|---|---|---|---|---|---|
| Runtime | Starting local service | N/A | Retry, diagnostics, close | Continue to Vault detection | Existing service/port conflict guidance |
| Vault setup | Validate path/list spaces | No registered Vaults | Keep input, explain invalid/inaccessible path | Show Vault name and location | Refuse overwrite or unsafe switch |
| Onboarding | Load topic | All optional topics skipped | Keep draft and retry | Candidate ID received | Candidate remains unconfirmed |
| Overview | Section skeletons | Contextual empty sections | Section-level retry | Current state shown | External change warning |
| Memory | Load queue/details | No candidates | Preserve edit and retry | Confirmed/rejected result | Revision conflict with draft retained |
| Profile | Load confirmed sections | Profile has no confirmed content | Retry or go to Memory | Updated confirmed summary | Hide denied/local-only data |
| Reflection | Load month/draft | No reflection for month | Keep draft and retry | Saved/confirmed result | Revision conflict and unsaved warning |
| Growth | Load records | No confirmed growth record | Retry | Assessment/history updated | Never fabricate unavailable score |
| Privacy | Load clients/audit | No authorised clients/events | Retry, verify audit chain | Permission/revoke result | Integrity failure shown prominently |
| Backup | Load backups | No local backup | Retry, retain diagnostics | Created/verified/restored | Block invalid/unverified restore |
| AI Connections | Load clients/providers | No connections | Retry | Token/authorisation result | Revoked/expired credential state |
| Settings | Load summaries | Optional integrations absent | Section-level retry | Setting saved | Unsupported setting remains unchanged |

## 3. First-run exception matrix

| Condition | User message | Safe default | Allowed actions |
|---|---|---|---|
| Local service failed | NEXORA could not start its local service | Do not open workspace | Retry, diagnostics, close |
| Vault missing | The previously used folder cannot be found | Keep registration | Locate, choose another, create new |
| Vault inaccessible | NEXORA cannot access this personal space | Do not recreate | Retry, choose another, help |
| Valid Vault exists | An existing personal space was found | Connect, do not create | Continue, choose another |
| Non-empty invalid folder | This folder cannot be used as a new Vault | No writes | Choose another, inspect folder |
| Setup interrupted | Continue your previous setup? | Resume same Vault | Continue, start over |
| Candidate save failed | Your answer has not been saved | Preserve draft | Retry, copy, skip |
| Reinstall detected | Existing personal space found | Reconnect existing Vault | Continue, locate another |

## 4. Operation feedback

- Loading feedback appears within 100ms for user-triggered actions.
- Success confirms the changed object, not merely “Done”.
- Errors do not remove user input.
- Retry does not duplicate candidates, backups or authorisations.
- Destructive actions describe the object and consequence.
- Toasts do not carry the only copy of critical information.

## 5. Responsive state checks

Every state must be verified at:

- 1440×1024;
- 1024×768;
- 390×844;
- 320px minimum width where supported;
- equivalent 200% browser zoom.

All states require no horizontal overflow, visible focus, 44–48px touch targets and readable error text.

## 6. Internationalisation checks

- Chinese and English use the same state semantics.
- Buttons do not depend on fixed text widths.
- Status labels are not hardcoded in touched components.
- Dates and times use the active locale.
- Technical codes may remain untranslated only as secondary detail.
