# Memory Space Design Specification

Status: Design for approval  
Last updated: 2026-11-24  
Implementation: Not started

## 1. Product role

Memory is NEXORA's Personal Knowledge Space. It lets the user explore what is known, understand how memory changes over time, and make human decisions about candidate content.

The page has three primary views:

1. **Graph**: spatial exploration of real memory and explicit topic metadata.
2. **Timeline**: evidence-backed memory creation and lifecycle changes.
3. **Review**: the existing Candidate → Confirmed / Rejected decision workflow.

Graph is the default Memory destination. Review remains the only place that confirms or rejects candidates.

## 2. Current technical audit

### 2.1 Memory data

The authenticated local Memory API exposes:

- `id`
- `status`
- `type`
- `subject`
- `sourceAgent`
- `created`
- `updated`
- `visibility`
- `aiAccess`
- `tags`
- `content`
- `revision`

`GET /api/v1/memories?status=...` supports `candidate`, `confirmed`, `rejected` and `archived`, with a maximum of 100 records per request.

### 2.2 Lifecycle

- Candidates live in `30 Memory/Inbox`.
- Confirmed, Rejected and Archived memories live in separate existing folders.
- Confirm/reject/edit actions require the current revision.
- Lifecycle operations produce security audit events such as `memory.candidate_created` and `memory.confirmed`.
- Existing Review unit tests cover edit, confirm and reject.

### 2.3 Timeline reality

`GET /api/v1/visualization/timeline` is currently a sorted snapshot of memory records. It uses `updated || created`, status and access rules. It does not return a complete event history.

Actual lifecycle events exist in the security audit chain and can be queried through `GET /api/v1/security/audit-events?resource_type=memory`. A true event Timeline must use those events and may use record timestamps only as a labelled fallback. It must not turn the current snapshot into fictional intermediate events.

### 2.4 Relationship reality

There is no memory relationship field, relationship collection or graph endpoint. `tags`, `type`, `subject` and `sourceAgent` exist, but none proves a semantic memory-to-memory relationship.

The existing relationship image in Profile is explicitly decorative and states that it does not represent personal data. It cannot be reused as a real graph.

### 2.5 Frontend foundation

- React 19, TypeScript and Vite.
- Phosphor icons only.
- No graph, force-layout, canvas or React Flow dependency.
- Current production build warns that the main JavaScript chunk is about 569 KB.
- Existing tests include Vitest, Playwright navigation/responsive tests and Axe scans.

## 3. Honest Graph V1

### 3.1 Node types

| Node | Source | Visual |
|---|---|---|
| Confirmed Memory | Confirmed records | Cyan/blue, solid centre |
| Pending Candidate | Inbox candidate records | Violet, interrupted/dashed halo |
| Topic | Explicit non-empty `tags` only | Larger neutral-cyan node |
| Type cluster | Existing `type` metadata | Spatial group label, not a semantic node |
| Source cluster | Existing `sourceAgent` filter | Filter/group label only, no relationship edge |

Topic nodes must not be generated from guessed keywords, embeddings or AI summaries in V1.

### 3.2 Edges

V1 draws only one edge type:

- `memory --tagged with--> topic`, derived from an explicit tag stored on that memory.

It draws no memory-to-memory edges. Equal source, type, dates, similar words or proximity in the layout do not become relationships.

If there are no explicit tags, the honest state is a spatial collection grouped by type with no connecting lines. The UI explains: “No explicit relationships are stored yet.”

### 3.3 Minimum compatible data strategy

Preferred implementation is a read-only derived endpoint:

`GET /api/v1/visualization/memory-graph?statuses=confirmed,candidate&limit=200`

It reads existing records and returns a projection without writing or changing Vault Schema:

```ts
type MemoryGraph = {
  nodes: Array<
    | { id: string; kind: 'memory'; status: 'confirmed' | 'candidate'; label: string; type: string; sourceAgent: string; created: string; updated: string; tags: string[]; preview: string; reviewable: boolean }
    | { id: string; kind: 'topic'; label: string; memberCount: number }
  >
  edges: Array<{ id: string; kind: 'explicit-tag'; source: string; target: string; evidence: { field: 'tags'; value: string } }>
  truncated: boolean
}
```

Privacy rules must be at least as strict as the existing local timeline. The endpoint is authenticated loopback UI data and must not change MCP egress rules.

Fallback without a new endpoint: fetch candidate and confirmed lists separately and derive only explicit tag edges in the frontend. This duplicates policy and is less desirable.

## 4. Desktop Graph design (1440px)

### Layout

- Existing App Shell remains.
- Memory header contains Graph / Timeline / Review tabs.
- A compact command rail contains search, status, source and time filters.
- The graph occupies the central canvas and receives most of the viewport.
- A minimal legend sits inside the canvas edge.
- Selecting a node opens a right-side inspector without navigating away.
- The inspector shows real metadata, content access state, timestamps, tags and evidence-backed connections.
- Candidate inspector primary action is “Open in Review”.

### Graph interaction

- Click a memory node: select and open inspector.
- Click a topic: isolate its explicit tag members.
- Drag a node: change only the local view position, never persisted data.
- Pan/zoom: viewport-only.
- Search: locate and focus matching loaded nodes.
- Status/source/date filters: remove non-matching nodes and recompute visible topic counts.
- Reset: reset filters, selection and viewport.
- Selecting a node highlights only explicit tag edges.

### Empty states

- No memories: explain how Import and onboarding create candidates.
- Confirmed memories but no tags: show unconnected nodes grouped by type and explain the absence of explicit relationships.
- Candidate-only Vault: show violet candidates and direct the user to Review.
- Truncated results: show the API limit and a filter action; do not imply the graph is complete.

## 5. Mobile Graph design (390px)

- Graph remains the default view but uses the full content width.
- Search and filters open in a bottom sheet.
- Legend collapses into one accessible button.
- Node inspector is a bottom sheet with three snap states: peek, detail and full content.
- Graph gestures use one-finger pan and pinch zoom; controls remain available for keyboard/switch users.
- “Open in Review” transitions to the selected candidate in Review.
- A persistent list-view fallback exposes every visible node and connection to assistive technology.

## 6. Timeline design

### Data hierarchy

1. Date/month grouping.
2. Actual lifecycle event type.
3. Memory subject/type where access permits.
4. Source/client and timestamp.
5. Result/reason for rejection or failed operations when present.

### Data rules

- Audit events are authoritative for lifecycle operations.
- `created` and `updated` are labelled as record timestamps when audit history is unavailable.
- Confirmation, rejection, update and archive are shown only when their event or current metadata supports them.
- Protected/local-only content does not leak into preview text.
- Filters: event type, status, source and date.

## 7. Review design

The current workflow is preserved:

- left: filters and candidate queue;
- centre: full content, source, timestamps, access, tags and revision;
- right: edit, rejection reason, reject and confirm;
- conflict errors retain the user's draft and request a refresh;
- success removes the resolved candidate from the queue and announces the result;
- explicit tag relationships may be listed as metadata, but no inferred relationship is shown.

Review never confirms in bulk in V1.

## 8. Component architecture

```text
MemorySpace
  MemoryViewTabs
  GraphView (lazy-loaded)
    GraphToolbar
    MemoryGraphCanvas
    GraphLegend
    GraphEmptyState
    GraphNodeInspector
    AccessibleGraphList
  MemoryTimelineView
    TimelineFilters
    TimelineEventList
    TimelineEventDetail
  MemoryReviewView
    existing MemoryReviewPage
      ReviewFilters
      CandidateQueue
      MemoryInspector
      HumanDecisionPanel
```

Recommended later dependency: `@xyflow/react`, lazy-loaded only for Graph. It provides pan, zoom, drag and custom nodes. V1 should use a deterministic cluster layout and avoid a perpetual force simulation. Do not add the dependency until design approval.

## 9. Interaction state matrix

| State | Graph | Timeline | Review |
|---|---|---|---|
| Loading | Stable node skeleton, controls disabled | Date-row skeleton | Existing queue/inspector skeleton |
| Empty | Import/onboarding action and honest explanation | “No memory events yet” | Existing no-candidate state |
| Partial | Truncation or protected-node notice | Snapshot fallback labelled clearly | Queue remains usable if stats fail |
| Error | Retry graph data; preserve filters | Retry; preserve date filter | Preserve draft and selection |
| Selected | Highlight explicit edges only | Open event detail | Open candidate inspector |
| Mutation | No graph writes | No timeline writes | Revision-checked edit/confirm/reject |
| Reduced motion | Instant focus/fit; no animated drift | No animated insertion | Existing reduced transitions |

## 10. Performance and accessibility

- Lazy-load Graph and its dependency so Review/Timeline do not increase initial bundle cost.
- Initial target: at most 200 memory nodes plus explicit topic nodes.
- Do not run continuous layout animation after stabilization.
- Use viewport culling provided by the graph library.
- Debounce search; filter already-loaded data without repeated requests.
- Provide an accessible list equivalent for canvas/spatial content.
- All toolbar controls have visible labels and keyboard operation.
- Node colors are reinforced by shape, label and legend.
- Respect `prefers-reduced-motion` and do not auto-pan on every data update.

## 11. Test plan

- Graph endpoint returns only real records and explicit tag edges.
- Records without tags create zero relationship edges.
- Candidate and confirmed colors also differ by shape/label.
- Selecting Candidate opens the correct Review record.
- Status/source/date filtering is deterministic.
- Timeline renders only audit events or labelled record timestamps.
- Local-only/protected memory does not expose content.
- Pan/zoom/reset and inspector work at 1440px and 390px.
- Keyboard, focus order, reduced motion and Axe checks pass.
- Existing edit/confirm/reject tests remain unchanged and pass.

## 12. Out of scope

- Vault Schema changes.
- AI-inferred semantic links.
- Embedding/vector storage.
- Automatic topic extraction.
- Persisted graph coordinates.
- Bulk confirmation.
- Changes to MCP permissions, Windows ACL or installer behaviour.

## 13. Design concepts

These images are design targets, not implemented runtime screens and not evidence of stored relationships or events.

- [Graph desktop, 1440px target](assets/memory-graph-desktop-concept.png)
- [Graph mobile, 390px target](assets/memory-graph-mobile-concept.png)
- [Timeline desktop target](assets/memory-timeline-concept.png)
- [Review desktop target](assets/memory-review-concept.png)
