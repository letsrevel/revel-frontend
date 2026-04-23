# Recurring Events — Frontend Implementation Plan

Companion to `RECURRING_EVENTS_UX.md`. That doc describes the target UX; this one reconciles it
with the current frontend and breaks work into shippable phases. **Treat this file as the PRD:
it stays authoritative across sessions; the checklist and log below live in peer files so the
plan itself doesn't churn.**

Backend reference: `revel-backend/.artifacts/openapi.json` (PR
[letsrevel/revel-backend#369](https://github.com/letsrevel/revel-backend/pull/369)).

## Working files (read every session)

| File | Role |
|---|---|
| `RECURRING_EVENTS_PLAN.md` (this doc) | PRD — architecture, contracts, decisions. Edit only when scope changes. |
| `RECURRING_EVENTS_UX.md` | UX source of truth — flows, copy, edge cases. |
| `_todo.txt` | Living checklist of shippable units, grouped by phase. Flip `[ ]` → `[~]` → `[x]` as you work. |
| `_progress.txt` | Append-only log of sessions — what shipped, what broke, mid-flight decisions, QA outcomes. |

At the start of each session:

1. Read the top of `_progress.txt` to pick up where the previous session left off.
2. Find the next unchecked item in `_todo.txt`; mark it `[~]` before editing code.
3. On completion, flip the item to `[x]`, append a dated entry to `_progress.txt`, and run the
   §QA gate below.

## QA gate (runs at the end of every shippable unit)

Every item in `_todo.txt` is "done" only after the gate below passes. The gate is cheap — run it
early, run it often — and protects the plan from drifting out of a green state.

### Always run (local QA)

From `revel-frontend/`:

```bash
make fix      # auto-fix prettier + eslint
make check    # format-check + lint (0 warnings) + types (svelte-check) + i18n-check + file-length
make test     # Vitest unit tests (saves failures to .tests.output)
```

If anything fails, **stop**, fix, re-run. Do not chain checklist items past a red gate.

### Run when needed (Playwright smoke)

Playwright is the expensive tail of the gate. Run it — against the local backend (running and
bootstrapped) — only when the change could affect runtime behaviour the user can actually see:

- **Always run after:** Phase 1 (wizard happy path), Phase 2 (dashboard render), Phase 3 (each
  mutating modal), Phase 4 (public series detail), Phase 5 (full UX release-checklist flow).
- **Can skip for:** Phase 0 utility-only changes, i18n key additions with no surface yet,
  type-only refactors.

When in doubt, run it:

```bash
make test-e2e
```

If a specific flow is targeted, prefer `pnpm test:e2e -- --grep "recurring"` to keep the loop
fast.

### Session wrap-up

Before handing off — whether the session ends mid-phase or after a full phase:

1. `_todo.txt` reflects reality (no stale `[~]` on abandoned work).
2. `_progress.txt` has a fresh entry: what shipped, what's next, any QA output worth keeping.
3. No uncommitted debug code; `git status` is clean except for work-in-progress on the current
   branch.

## Backend dependencies

Both FE blockers from the first draft of this plan are resolved by backend
[PR #378](https://github.com/letsrevel/revel-backend/pull/378) (closes
[#376](https://github.com/letsrevel/revel-backend/issues/376) and
[#377](https://github.com/letsrevel/revel-backend/issues/377)):

| Endpoint | Purpose |
|---|---|
| `GET /organization-admin/{slug}/event-series/{series_id}` → `EventSeriesRecurrenceDetailSchema` | Dashboard load; full admin shape (rule, template, exdates, `last_generated_until`, window, flags). |
| `GET /organization-admin/{slug}/event-series/{series_id}/drift` → `EventSeriesDriftSchema` | `{ stale_occurrences: UUID[] }` — server-computed IDs of future occurrences whose start no longer matches the current rule. |

**Drift semantics** (from the PR, locks Appendix on decision #5): an occurrence is in
`stale_occurrences` iff it's future, non-CANCELLED, non-template, **and `is_modified=False`**.
Manually-edited occurrences are deliberately excluded because the organiser shifted them off the
cadence on purpose. UTC-normalized comparison; exdates removed from the expected set.

Practical consequences for the FE:

- **Drift indicator and `is_modified` badge are mutually exclusive** on a given row — they never
  both apply. Treat them as two distinct row states.
- **No bulk-cancel endpoint ships in #378.** The FE's "Cancel all stale dates" bulk action (if
  built) has to loop `POST /cancel-occurrence` per date. See Phase 3 for safeguards.

No remaining backend blockers. Phase 1 and Phase 2 can start as soon as `pnpm generate:api` picks
up the new endpoints.

## Reconciliation notes (UX doc vs. current FE)

The UX doc was written without full knowledge of the existing FE. The following adjustments apply:

| UX doc says | Current FE reality | Plan |
|---|---|---|
| Route: `/org/:slug/series/:id/manage` | Existing convention: `/org/[slug]/admin/event-series/[series_id]/edit` | Use `/org/[slug]/admin/event-series/[series_id]/` as the **new dashboard (index)** route; keep `edit` as a simpler metadata editor for the non-recurring case, or deprecate it. |
| "Create recurring event" = a brand-new wizard | `/admin/event-series/new` already exists (2-field form that creates an *empty* series, useful for grouping). `/admin/events/new` creates single events and can attach to a series. | Keep `/event-series/new` as the "empty series" form **and** add a new route `/admin/event-series/new-recurring` that renders the two-step recurring wizard. On the series list page, the primary CTA becomes "New recurring series" with a secondary "Create empty series" link. |
| Hide `status` selector in wizard Step A | `EssentialsStep.svelte` already has no user-facing status selector — status is always set server-side for drafts. | No change needed; verify the create-recurring-event payload does not send `status`. |
| Reuse "existing event form" as Step A | `EventEditor.svelte` is a full multi-tab editor (Essentials / Details / Ticketing / Resources). The **ticketing** and **resources** tabs require a created event ID (they call per-event endpoints). | Extract the **event shape subset** accepted by `RecurringEventCreateSchema.event` (which is `EventCreateSchema`) and reuse only `EssentialsStep` + `DetailsStep` in a thin wrapper. Ticket tiers and resources are attached to the **template event** after creation via a follow-up step on the dashboard. |
| Component `SeriesDashboard.svelte` as "page" | SvelteKit pages are route files, not components. | Build the dashboard *as* the route `[series_id]/+page.svelte`, composed of smaller components (`SeriesHeaderCard`, `OccurrenceRow`, etc.). |
| i18n "namespace" | Paraglide in this repo is flat (keys like `m['eventseriesnewpage.title']`). There is no true namespace. | Use a consistent flat prefix `recurringevents.*` (lower-case, concatenated — matches project style). |
| "`rrule_string` — never render raw" | Confirmed: the structured `RecurrenceRuleSchema` is returned alongside `rrule_string`. | Implement a `formatRecurrence()` pure function keyed off structured fields + i18n. `rrule_string` is debug-only (dev tooltip at most). |

## Backend contract (confirmed from OpenAPI)

All paths under `/api/organization-admin/{slug}/…`:

| Endpoint | Operation ID | Schemas |
|---|---|---|
| `POST /create-recurring-event` | `organizationadminrecurringevents_create_recurring_event_*` | Req `RecurringEventCreateSchema` / Resp `EventSeriesRecurrenceDetailSchema` |
| `PATCH /event-series/{id}/template?propagate=none\|future_unmodified\|all_future` | `…_update_template_*` | Req `TemplateEditSchema` (`additionalProperties=false`) / Resp `EventSeriesRecurrenceDetailSchema` |
| `PATCH /event-series/{id}/recurrence` | `…_update_recurrence_*` | Req `EventSeriesRecurrenceUpdateSchema` (all fields optional) / Resp same |
| `POST /event-series/{id}/cancel-occurrence` | `…_cancel_occurrence_*` | Req `CancelOccurrenceSchema` `{ occurrence_date: datetime }` / Resp same |
| `POST /event-series/{id}/generate` | `…_generate_events_*` | Req `GenerateSeriesEventsSchema` `{ until?: datetime }` / Resp `EventDetailSchema[]` |
| `POST /event-series/{id}/pause` | `…_pause_series_*` | No body / Resp same |
| `POST /event-series/{id}/resume` | `…_resume_series_*` | No body / Resp same |

Enums: `Frequency = daily|weekly|monthly|yearly`, `MonthlyType = day|weekday`,
`PropagateScope = none|future_unmodified|all_future`.

`EventDetailSchema` already carries `is_template`, `is_modified`, `occurrence_index`,
`event_series`.

## Phased delivery

### Phase 0 — Foundations (no user-visible changes)

Goal: land plumbing and shared utilities so later phases can move fast.

1. **Regenerate API client.** Run `pnpm generate:api` to pull in `RecurringEventCreateSchema`,
   `EventSeriesRecurrenceDetailSchema`, `RecurrenceRuleSchema`, `TemplateEditSchema`, etc.
2. **Pure utilities in `src/lib/utils/recurrence.ts`:**
   - `formatRecurrence(rule: RecurrenceRuleSchema, locale: string): string` — the human-readable
     renderer used in the dashboard, create/edit summaries, and notifications. Covers weekly
     multiselect, monthly day-of-month vs. nth-weekday, boundaries (`until` / `count` / neither),
     and interval > 1. Unit-tested exhaustively.
   - `parseExdates(exdates: string[]): Date[]` — ISO 8601 → `Date` with invalid-entry filter.
   - `mutualExclusionGuard({ until, count })` — for UI before submit.
   - `weekdayLabel(n: 0-6)`, `ordinalLabel(n: 1-4 | -1)` — for form UI.
3. **Shared types in `src/lib/types/recurrence.ts`:** re-export the generated schemas under
   friendlier names and expose `Frequency` / `MonthlyType` / `PropagateScope` constants.
4. **Query keys + typed wrappers** in `src/lib/queries/event-series.ts`:
   - `seriesQueryKeys.detail(seriesId)` — public series.
   - `seriesQueryKeys.recurrenceDetail(slug, seriesId)` — admin, returns
     `EventSeriesRecurrenceDetailSchema` via the new `GET` from PR #378.
   - `seriesQueryKeys.drift(slug, seriesId)` — admin, returns `EventSeriesDriftSchema`. Every
     mutating flow that can change drift state (recurrence update, cancel occurrence, generate,
     bulk-cancel-drifted) invalidates this key.
   - `seriesQueryKeys.occurrences(seriesId, { past?: boolean })` — wraps `/events/` filtered by
     series.
5. **i18n keys**: add `recurringevents.*` prefix stubs for all copy listed in the UX doc.
   Start with EN; IT + DE follow before launch.

**Tests**: unit tests for `formatRecurrence` (golden files covering every branch) and
`parseExdates`.

### Phase 1 — Create recurring event wizard

Deliverable: organisers can create a new recurring series end-to-end.

1. **Route**: `src/routes/(auth)/org/[slug]/admin/event-series/new-recurring/+page.svelte`
   + `+page.server.ts` (load org + cities same as `events/new`).
2. **Page scaffold** is a 2-step wizard (server-side state between steps is unnecessary — keep it
   client-side in the page component; user can only submit once both are valid).
3. **Step A — Template event**: a trimmed wrapper around `EssentialsStep` + `DetailsStep` (no
   ticketing / resources / status tabs). Collect an `EventCreateSchema`-shaped payload.
   - Exclude `event_series_id` (backend binds it).
   - Surface a helper under the `start` field: *"This is also the anchor date for the recurrence
     — every future occurrence is computed from here."*
4. **Step B — Recurrence & series settings** (new `RecurrencePicker.svelte`):
   - Series name (prefills from event name) + optional description.
   - `frequency` segmented control → reveals conditional UI:
     - **Weekly** → weekday multiselect (Mon–Sun, keyboard-accessible toggle group).
     - **Monthly** → mode tabs: **Day of month** (1–31 input) / **Nth weekday** (ordinal picker
       1/2/3/4/Last + weekday picker).
     - **Daily** / **Yearly** → no extra fields beyond `interval`.
   - `interval` number input (min 1) with a natural-language helper.
   - Boundary radio: **None** / **Until date** / **N occurrences**. Switching clears the other
     two. Client-side mutual-exclusion guard mirrors backend constraint.
   - Advanced (collapsed): `auto_publish` toggle, `generation_window_weeks` slider (1–52, default
     8). Show the UX doc's copy verbatim for each.
   - Timezone field is read-only text prefilled from browser IANA tz, with the advisory helper:
     *"Times are anchored to the UTC start you chose. DST-aware recurrence is coming later."*
   - Live `RecurrenceSummary` preview at the bottom.
5. **Submit** calls the generated SDK function (name will be
   `organizationadminrecurringeventsCreateRecurringEvent` or similar) with the combined payload.
   On success: `goto('/org/{slug}/admin/event-series/{new_id}')` and toast.
6. **Error handling** (matches project-wide conventions in `ERROR_HANDLING.md`):
   - 422 → inline field errors from `response.errors[]`, scroll the first error into view.
   - 400 `detail` → banner + toast (verbatim).
   - Network → toast + inline retry.
7. **Entry point**: on `src/routes/(auth)/org/[slug]/admin/event-series/+page.svelte`, change the
   primary CTA to **"New recurring series"** linking here. Keep a secondary "Create empty series"
   action for the current non-recurring flow.

**Tests**:
- Component test: `RecurrencePicker` — each frequency + boundary combination produces the
  expected payload.
- Component test: wizard step navigation (can't advance without required Step A fields; can't
  submit until Step B is valid).
- Playwright happy path: create weekly → land on dashboard → see occurrences list.

### Phase 2 — Series admin dashboard

Deliverable: one screen to view, diagnose, and act on a running series.

1. **Route**: `src/routes/(auth)/org/[slug]/admin/event-series/[series_id]/+page.svelte`
   + `+page.server.ts`. The server load fetches in parallel:
   - Full admin series detail via the new `GET /organization-admin/{slug}/event-series/{series_id}`
     (expected SDK: `organizationadminrecurringeventsGetSeriesDetail` — see Appendix A).
     Returns `EventSeriesRecurrenceDetailSchema`.
   - Drift state via `GET .../event-series/{series_id}/drift` (expected SDK:
     `organizationadminrecurringeventsGetSeriesDrift`). Returns `{ stale_occurrences: UUID[] }`.
     Build a `Set<string>` on the client for O(1) lookup in `OccurrenceRow`.
   - Upcoming occurrences: `eventseriesGetEvents` filtered by series + `include_past=false`.
   - Past occurrences (lazy, on tab click).
2. **Components** (under `src/lib/components/event-series/admin/`):
   - `SeriesHeaderCard.svelte` — name, description, logo, status chip (Active/Paused), auto-publish
     badge, horizon line (*"Scheduled up to …"* from `last_generated_until`), action row: Series
     settings · Edit template · Edit recurrence · Cancel occurrence · Generate now · Pause/Resume.
   - `RecurrenceSummary.svelte` — consumes `formatRecurrence()`.
   - `OccurrenceRow.svelte` — wrapper over existing `AdminEventCard`. Accepts a `driftedIds:
     Set<string>` prop. Row state follows the convention locked in resolved decision #5:
       - `is_modified=true` → amber left-border accent + "Manually edited" badge.
       - `driftedIds.has(event.id)` → red/warning left-border accent + "Off-schedule" badge
         (mutually exclusive with the above — backend guarantees this).
     Row also shows `occurrence_index` label (*"Week 4"*) and a quick-action "Cancel this date".
   - `ExdatesChipList.svelte` — chips for cancelled dates. Each chip exposes a "Create one-off
     event for this date" action that `goto`s the single-event creation form with `start`
     prefilled and the series pre-attached. Semantic helper rendered below the list: *"Creating
     a one-off event adds a standalone event to the series; it won't pick up future changes to
     the template."*
   - `CadenceDriftBanner.svelte` — data-driven banner keyed off the `stale_occurrences` array
     from the drift query. Renders only when the array is non-empty. Not dismissible — it's an
     accurate server-authoritative signal, hides itself as soon as the count reaches zero. Copy
     includes the count, a "Review stale dates" anchor that scrolls to the first drifted row,
     and (Phase 3) a "Cancel all N stale dates" button that opens
     `CancelDriftedOccurrencesDialog`.
3. **Empty / degraded states** (UX doc edge cases):
   - Series with `is_active=false`: prominent paused banner at the top of the header card.
   - Series with `recurrence_rule=null` or `template_event=null` (legacy data): show a "Repair
     series" banner with a mail-to-support link and **hide** the action buttons that depend on
     those fields.
4. **Series-settings-via-dialog** (replaces the retired `/edit` page):
   - `SeriesSettingsDialog.svelte` — bits-ui `Dialog` containing: name, description, logo upload,
     cover art upload, tags editor. Reuses the logo/cover upload mutations already present in
     `EventEditor.svelte`.
   - Header card opens the dialog via a "Series settings" button.
   - Page load reads `?settings=open` and auto-opens the dialog on first render (supports the
     redirect from the deprecated `/edit` URL).
5. **Mobile**: action row collapses to a bottom action sheet (`vaul-svelte` pattern already in
   use for other admin surfaces).
6. **Post-mutation refresh**: every action modal calls `invalidate` on the series detail query
   to reflect server-authoritative state (UX doc edge case: concurrent edits).

**Tests**:
- Component test: `OccurrenceRow` renders `is_modified` badge; quick-cancel button dispatches
  correct event.
- Playwright: navigate to dashboard, verify header info and occurrence list render from a seeded
  series.

### Phase 3 — Mutating flows (modals)

All modals follow the existing pattern (`DuplicateEventModal`, `SeriesResourceAssignmentModal`):
bits-ui `Dialog`, `createMutation`, invalidate on success, error handling per §Phase 1.6.

1. **`TemplateEditDialog.svelte`** (complex — dedicate extra review time):
   - Body: a form with *only* the fields allowed by `TemplateEditSchema`. Critical: unknown
     fields produce 422, so we must NOT inherit the full event form. Build this as a dedicated,
     narrower form reusing smaller primitives (e.g. the visibility picker from `EssentialsStep`
     extracted to a shared component if needed).
   - Explicitly not editable: show disabled `start`/`end`/`rsvp_before`/`apply_before`/`status`
     fields with tooltip explanations straight from the UX doc.
   - On submit: open a **second-step propagation picker** (three radio options: `none` /
     `future_unmodified` (default, "recommended") / `all_future` (destructive red style)) before
     issuing the PATCH with the chosen `?propagate=…`.
2. **`RecurrenceEditDialog.svelte`**:
   - Reuses `RecurrencePicker` in *edit mode* (prop toggles `dtstart` to read-only + shows the
     "Contact support to reschedule" helper).
   - Cadence change confirmation dialog with the exact UX-doc copy about already-scheduled dates.
   - Sends only changed fields (`PATCH` with partial payload).
   - On success: invalidate both the series detail and drift queries. Backend now authoritatively
     computes drift, so no client-side bookkeeping is needed — the banner appears or disappears
     based on the refetched drift response.
3. **`CancelOccurrenceDialog.svelte`**:
   - Two entry points: from `OccurrenceRow` (prefilled `occurrence_date`) or from the header card
     (datetime picker).
   - Confirmation copy includes the tickets-notified-and-refunded caveat.
   - On success: invalidate the series detail, occurrences list, and drift queries.
4. **`GenerateNowButton.svelte`**:
   - Optional `until` datetime picker inside a small popover (or skip to defaults on single-click).
   - Toasts: non-empty → *"N new occurrences scheduled through {date}"*; empty → *"Already up to
     date — no new occurrences to generate."*
   - Invalidate series detail, occurrences list, and drift queries on success.
5. **`PauseResumeButton.svelte`**:
   - Pause requires confirmation; Resume is single-click.
   - Disabled state while mutating.
6. **`CancelDriftedOccurrencesDialog.svelte`** (optional bulk-cancel flow):
   - Entry point: "Cancel all N stale dates" button inside `CadenceDriftBanner`.
   - Body lists every stale date (fetched from the occurrences list, filtered by
     `stale_occurrences`). Two read-only columns: date + current status (OPEN/DRAFT).
   - Destructive-style confirm button with an explicit "I understand these events will be
     cancelled and tickets refunded" checkbox to arm it.
   - Submit loops `POST /cancel-occurrence` **sequentially** (not parallel — deterministic
     partial-failure behaviour). Each row shows a live per-row status indicator: pending → in
     flight → done / error.
   - If any row fails, stop the loop, show the remaining count, and leave the dialog open so the
     organiser can retry. Do not roll back successful cancels (backend has already refunded those
     tickets).
   - On full success: toast "{n} dates cancelled" and invalidate series detail + drift +
     occurrences queries.
   - Consider gating this behind a safety threshold (e.g. if `stale_occurrences.length > 25`,
     show a warning that bulk-cancel will take a while and may partially fail; no threshold-based
     block, just extra friction).
7. **`SeriesSettingsDialog.svelte`** (see Phase 2 §4) — not strictly a "recurring" mutation, but
   built as part of this wave since it replaces the retired `/edit` route. PATCH via the existing
   `eventseriesadmin_update_event_series_*` endpoint + logo/cover upload endpoints.

**Tests**: per modal, a component test asserting:
- The correct PATCH/POST payload shape is dispatched.
- `propagate` query param is set per user selection in `TemplateEditDialog`.
- Error rendering.

Plus a Playwright end-to-end per the UX doc release checklist:
create → dashboard → edit template with propagation → cancel one → pause → resume.

### Phase 4 — Attendee-side polish

Deliverable: public-facing series detail + follow dialog reflect recurring behaviour.

1. **Series detail page** (`/events/[org_slug]/series/[series_slug]/`) already exists. Audit it
   to confirm the public `EventSeriesRetrieveSchema` does **not** leak `recurrence_rule`,
   `template_event`, `exdates` — if a recent schema change added any, strip from UI.
2. **Follow dialog copy**: append the UX doc's digest-notification copy when
   `series.auto_publish === true`. (Backend behaviour unchanged; FE only updates wording.)
3. **Template event defence-in-depth**: in any code path that renders an event, short-circuit
   to 404 when `event.is_template === true`. Centralize this check in the server load for
   `/events/[org_slug]/[event_slug]/+page.server.ts` (and its admin twin if relevant).

### Phase 5 — i18n, accessibility, release

1. **i18n completion**: EN → IT → DE for every new `recurringevents.*` key. Run `pnpm
   paraglide:compile` (per memory: never use `npx` directly — use the pnpm script).
2. **Accessibility pass** on `RecurrencePicker`:
   - Weekday multiselect = toggle-group `role="group"` with labelled child toggles; arrow-key
     navigation; `aria-pressed` reflects state.
   - Ordinal + weekday sub-selector for monthly nth-weekday: keyboard traversal and clear label
     association.
   - Live-region announcement for the recurrence summary so screen readers hear the computed
     "Every Monday starting …" when users change fields.
3. **Mobile QA** on the dashboard with a phone via `make dev` (local IP + port 5173).
4. **Playwright** flows from the UX doc release checklist.
5. **SEO**: confirm `/events/[org_slug]/series/[series_slug]` remains SSR and includes upcoming
   dates in its HTML for indexing.

## Route tree after landing

```
/org/[slug]/admin/event-series/
├── +page.svelte                                 # list; primary CTA "New recurring series" + secondary "Create empty series"
├── new/                                         # existing: empty series (2-field form) — unchanged
├── new-recurring/                               # NEW: recurring event wizard
└── [series_id]/
    ├── +page.svelte                             # NEW: dashboard (the canonical series page)
    └── edit/+redirect                           # deprecated route → redirects to `../?settings=open` for one release, then removed
```

## Component inventory

| Component | Path | Notes |
|---|---|---|
| `RecurrencePicker.svelte` | `src/lib/components/event-series/admin/` | Used in wizard Step B and `RecurrenceEditDialog`. |
| `RecurrenceSummary.svelte` | `src/lib/components/event-series/admin/` | Thin wrapper over `formatRecurrence()`; used in dashboard + live preview. |
| `SeriesHeaderCard.svelte` | `src/lib/components/event-series/admin/` | Status, auto-publish, horizon, action row; "Series settings" button opens `SeriesSettingsDialog`. |
| `OccurrenceRow.svelte` | `src/lib/components/event-series/admin/` | Wraps `AdminEventCard`. Accepts `driftedIds: Set<string>`. Row states: normal / `is_modified` (amber accent + "Manually edited") / drifted (red accent + "Off-schedule"). States are mutually exclusive (backend guarantees this). |
| `ExdatesChipList.svelte` | `src/lib/components/event-series/admin/` | Chips with "Create one-off event for this date" action per chip + semantic helper copy below the list. |
| `TemplateEditDialog.svelte` | `src/lib/components/event-series/admin/` | Two-step: form → propagation picker. |
| `RecurrenceEditDialog.svelte` | `src/lib/components/event-series/admin/` | Reuses `RecurrencePicker`; `dtstart` read-only. Invalidates series detail + drift queries on success. |
| `CancelOccurrenceDialog.svelte` | `src/lib/components/event-series/admin/` | Shared by row-level and header-level entries. Invalidates series detail + occurrences + drift queries on success. |
| `CancelDriftedOccurrencesDialog.svelte` | `src/lib/components/event-series/admin/` | Bulk-cancel flow for drifted occurrences. Sequential per-date `POST /cancel-occurrence` with per-row live status, deterministic partial-failure handling, armed by an "I understand" checkbox. |
| `GenerateNowButton.svelte` | `src/lib/components/event-series/admin/` | Popover for optional `until`. Invalidates series detail + occurrences + drift queries on success. |
| `PauseResumeButton.svelte` | `src/lib/components/event-series/admin/` | Toggle with confirmation. |
| `SeriesSettingsDialog.svelte` | `src/lib/components/event-series/admin/` | Replaces the retired `/edit` page — name, description, logo, cover art, tags. Auto-opens when loaded with `?settings=open`. |
| `CadenceDriftBanner.svelte` | `src/lib/components/event-series/admin/` | Data-driven banner — renders when `stale_occurrences.length > 0`. Not dismissible. Shows count, "Review stale dates" anchor, and (Phase 3) a "Cancel all N stale dates" button opening `CancelDriftedOccurrencesDialog`. |
| `RecurringEventWizard.svelte` | `src/lib/components/event-series/admin/` | Owns Step A + Step B for the new route. |

## Reuse vs. new

- **Reuse**: `EssentialsStep`, `DetailsStep`, `AdminEventCard`, `Dialog/Tabs/Button/Input` from
  `$lib/components/ui/*`, existing create-event server load for city resolution, existing error
  patterns.
- **Do not reuse**: the full `EventEditor` (contains ticketing/resources tabs that require an
  event ID — doesn't apply to the template creation flow).

## Resolved decisions

All five open questions below were brainstormed and locked in. Revisit only if usage data
contradicts the call.

### 1. Empty-series vs. recurring creation routes

**Decision:** keep two separate routes. `/admin/event-series/new` remains the existing 2-field
"empty series" form; `/admin/event-series/new-recurring` is the new recurring-event wizard. The
series list page's primary CTA is **"New recurring series"** with a secondary **"Create empty
series"** link underneath.

**Why:** lowest-risk migration; no UX regression for existing users; clean separation of mental
models. A unified type-picker at `/new` would be a speed bump for the common case (recurring)
without teaching much.

**Revisit if:** telemetry shows <5% of new series use the empty flow, in which case fold it
behind an Advanced link.

### 2. Dashboard as the canonical series page; fold metadata into a dialog

**Decision:** `[series_id]/+page.svelte` **is** the dashboard (header card + recurrence summary +
occurrences list). The existing `/edit` route is retired and replaced by a **Series settings
dialog** (name, description, logo, cover art, tags) reachable from the dashboard header — same
modal pattern as `TemplateEditDialog` and `RecurrenceEditDialog`.

**Migration:** for one release cycle, `/edit` redirects to the dashboard with a
`?settings=open` query param that auto-opens the dialog. Then the redirect is removed.

**Why:** the dashboard is already the dispatch point for every other mutation (template,
recurrence, cancel, pause/resume, generate). Name/description/logo editing as a dialog is
consistent and removes a redundant navigation jump.

### 3. Visual treatment of `is_modified` occurrences

**Decision (Phase 1):** badge + 3–4px left-border accent in an amber/warning hue on the
`OccurrenceRow`. No filter, no tab, no count.

**Decision (Phase 2, follow-up):** add a **Modified / Unmodified / All** filter above the
occurrences list *if* real usage shows organisers struggling to audit drift. Ship only once
there's a concrete pain signal.

**Why:** accent + badge covers the scan-for-drift case at near-zero cost and matches patterns
already used for draft rows. A filter solves a different problem (batch audit) and is easy to
bolt on later.

### 4. Reinstate a cancelled date

**Decision:** `ExdatesChipList` renders read-only chips. Each chip has a small **"Create a
one-off event for this date"** action that opens the existing single-event creation flow with
`start` prefilled and the series pre-attached. A single-line helper under the list explains the
semantics: *"Creating a one-off event adds a standalone event to the series; it won't pick up
future changes to the template."*

**Why:** self-service recovery using plumbing that already exists, with no backend dependency.
The resulting event is semantically a new `is_modified=true` event rather than a true
"reinstated" occurrence — the helper copy makes that honest.

**Revisit if:** backend ships an endpoint that removes a date from `exdates` and regenerates
under the current rule. At that point the chip action switches to a true reinstate.

### 5. Cadence-change drift banner — server-authoritative

**Decision (upgraded after backend PR #378 shipped drift detection):** the dashboard fetches
`GET .../drift` alongside the admin series detail. If `stale_occurrences.length > 0`, render a
prominent (non-dismissible) banner at the top of the dashboard showing the count and a "Review
stale dates" anchor that scrolls to the upcoming list. Each drifted occurrence in the list gets
a distinct row indicator — separate from the `is_modified` accent and badge, because the backend
already excludes `is_modified=True` rows from drift.

> *"{n} occurrence(s) are scheduled under the previous rule. They won't be regenerated; cancel
> them individually or in bulk to clean up the calendar."*

Banner visibility is driven entirely by the server response — no `localStorage`, no per-browser
state, no "dismissed" flag. Once the organiser cancels the stale dates (individually or via the
bulk action), drift returns an empty list and the banner disappears on the next query
invalidation.

**Bulk cancel** ships as an optional Phase 3 affordance (`CancelDriftedOccurrencesDialog`):
confirmation dialog lists every stale date, issues `POST /cancel-occurrence` **sequentially**
with a per-row status indicator, and handles partial failure by leaving succeeded cancels in
place and reporting the remaining ones. Not parallelized to avoid hammering the backend and to
make partial-failure recovery deterministic.

**Why this approach:** backend drift detection (PR #378) authoritatively classifies drift
against `dateutil.rrule`, removing the need for any client-side RRULE matching. The server
semantics also handle the subtle `is_modified` exclusion correctly, which a client-side matcher
would have gotten wrong.

**Row indicator convention** (locked to prevent visual collisions with decision #3):

| Row state | Visual |
|---|---|
| Normal occurrence | No accent, no badge. |
| `is_modified=true` (organiser edited directly) | Amber left-border accent + "Manually edited" badge. |
| Drifted (in `stale_occurrences`) | **Red/warning** left-border accent + "Off-schedule" badge. |
| Both? | Cannot happen — backend drift logic excludes `is_modified=true`. |

## Risks / watch-outs

- **`TemplateEditSchema.additionalProperties=false`** — any accidental extra field (e.g. from a
  reused form component) produces a 422. Isolate the template form from the main event form.
- **Timezone advisory**: do not render timezone-localized occurrence times until backend phase
  3 ships DST support. Use the UTC-anchored `start` as-is (same as other event surfaces).
- **`exdates` wire format is `string[]`** — treat generated type with suspicion; parse with
  `new Date(s)` and filter invalid entries.
- **Cascading delete of a series** — if we add a delete button before backend adds soft-delete,
  the confirmation copy from the UX doc (tickets refunded) must be exact.
- **Concurrent admin edits**: always invalidate + refetch the series detail after every mutation
  (helpers in `queries/event-series.ts`).
- **`/edit` redirect window** — the deprecated route should 301-redirect to
  `[series_id]/?settings=open` for at least one release cycle before being removed; external links
  (support docs, backend emails) may still point to it.
- **Bulk-cancel-drifted is N sequential requests** — no backend bulk endpoint ships in PR #378.
  For very long series with many drifted occurrences, the dialog can take a while and may
  partially fail. Handle partial failure deterministically (stop-and-report; leave successful
  cancels in place since their refunds have already fired). Do not parallelize — backend
  throttling and partial-failure traceability both benefit from sequential execution.
- **Drift endpoint excludes `is_modified=True`** — the FE must NOT treat "not in
  `stale_occurrences`" as "definitely on-schedule". An `is_modified` row could sit anywhere on
  the calendar but is never reported as drift by design. The `OccurrenceRow` visual convention
  (decision #5) accounts for this by giving modified rows a distinct visual treatment.

## Estimate (rough)

- Phase 0: 0.5 day
- Phase 1: 2 days (wizard + `RecurrencePicker` is the biggest single chunk)
- Phase 2: 2 days (dashboard load via new admin GET + drift query; `SeriesSettingsDialog`
  replacing `/edit`; drift banner + row indicator — simpler now that the banner is data-driven)
- Phase 3: 2.5 days (5 recurring modals + 1 settings dialog + `CancelDriftedOccurrencesDialog`
  with per-row status; `TemplateEditDialog` is the one to review carefully)
- Phase 4: 0.5 day
- Phase 5: 1 day

Total: ~8.5 engineer-days for a single focused contributor. Each phase is independently
shippable behind internal dogfooding; the feature is fully usable after Phase 3. The bulk-cancel
dialog can be deferred to a follow-up if the team wants to ship the main feature sooner —
per-occurrence cancel still works, just without the batch affordance.

---

## Appendix A — Generated SDK function names

The SDK's code generator follows the pattern `<tag>_<operation>` (operation IDs from the
OpenAPI spec) → `<tag><Operation>` in `camelCase`, concatenated (first word lowercase, no
underscore, subsequent words title-cased). Verified against existing exports in
`src/lib/api/generated/sdk.gen.ts` (`organizationadmincoreCreateEvent`,
`eventseriesadminUpdateEventSeries`, etc.).

After `pnpm generate:api`, the following functions are expected to exist:

| Endpoint | Generated name |
|---|---|
| `POST /api/organization-admin/{slug}/create-recurring-event` | `organizationadminrecurringeventsCreateRecurringEvent` |
| `GET /api/organization-admin/{slug}/event-series/{series_id}` *(PR #378)* | `organizationadminrecurringeventsGetSeriesDetail` |
| `GET /api/organization-admin/{slug}/event-series/{series_id}/drift` *(PR #378)* | `organizationadminrecurringeventsGetSeriesDrift` |
| `PATCH /api/organization-admin/{slug}/event-series/{series_id}/template` | `organizationadminrecurringeventsUpdateTemplate` |
| `PATCH /api/organization-admin/{slug}/event-series/{series_id}/recurrence` | `organizationadminrecurringeventsUpdateRecurrence` |
| `POST /api/organization-admin/{slug}/event-series/{series_id}/cancel-occurrence` | `organizationadminrecurringeventsCancelOccurrence` |
| `POST /api/organization-admin/{slug}/event-series/{series_id}/generate` | `organizationadminrecurringeventsGenerateEvents` |
| `POST /api/organization-admin/{slug}/event-series/{series_id}/pause` | `organizationadminrecurringeventsPauseSeries` |
| `POST /api/organization-admin/{slug}/event-series/{series_id}/resume` | `organizationadminrecurringeventsResumeSeries` |

New types from PR #378 (expected in `types.gen.ts` after `generate:api`):

- `EventSeriesDriftSchema` — `{ stale_occurrences: string[] }` (UUIDs serialize as strings in
  the generated client).

If the generator produces slightly different names (e.g. because operationIds change), grep
`sdk.gen.ts` for `organizationadminrecurringevents` and adjust — the tag is stable.

Existing SDK functions reused by the plan:

- `organizationadmincoreCreateEvent` — one-off event creation (used by the "Create one-off event
  for this date" chip action on `ExdatesChipList`).
- `eventseriesadminUpdateEventSeries` — PUT for name/description/slug/etc. (powers
  `SeriesSettingsDialog`).
- `eventseriesadminUploadLogo` / `UploadCoverArt` / `DeleteLogo` / `DeleteCoverArt` — logo &
  cover upload in `SeriesSettingsDialog` and in the wizard's template step if the user wants to
  set media at creation time.
- `eventseriesadminAddTags` / `RemoveTags` / `ClearTags` — tag editor in `SeriesSettingsDialog`.
- `eventseriesGetEventSeries` — public GET; the only fallback for dashboard load if
  [#377](https://github.com/letsrevel/revel-backend/issues/377) ships late.

## Appendix B — Wizard composition (Phase 1)

`RecurringEventWizard.svelte` owns two local steps:

```ts
type WizardStep = 'event' | 'recurrence';
let currentStep = $state<WizardStep>('event');
let eventData = $state<Partial<EventCreateSchema>>({ /* defaults mirror events/new */ });
let recurrenceData = $state<Partial<RecurrenceRuleCreateSchema>>({
  frequency: 'weekly',
  interval: 1,
  weekdays: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});
let seriesName = $state<string>('');
let seriesDescription = $state<string | null>(null);
let autoPublish = $state(false);
let generationWindowWeeks = $state(8);
```

**Step A template:** renders `<EssentialsStep standalone={false} formData={eventData} … />`
followed by `<DetailsStep standalone={false} formData={eventData} … />`. The `standalone={false}`
prop (already implemented) strips the internal form wrapper + nav buttons so the wizard can drive
its own navigation. Omit `TicketingStep` and `EventResources` entirely — these are applied later
to the template event on the dashboard.

**Anchor-date auto-prefill:** when Step A's `start` changes, derive Step B's `dtstart = start` by
default (organiser can override later). Also auto-derive `recurrenceData.weekday` /
`recurrenceData.weekdays` hints from the weekday of `start` as a convenience.

**Submit payload shape:**

```ts
const payload: RecurringEventCreateSchema = {
  series_name: seriesName,
  series_description: seriesDescription,
  auto_publish: autoPublish,
  generation_window_weeks: generationWindowWeeks,
  event: eventData as EventCreateSchema,            // no event_series_id, no status
  recurrence: {
    ...recurrenceData,
    dtstart: eventData.start ?? '',                 // backend anchors on the event start
  } as RecurrenceRuleCreateSchema,
};
```

Do **not** include `status` or `event_series_id` in `event`; backend forces `status=draft` and
binds `event_series_id` itself.

## Appendix C — Client-side validation rules (RecurrencePicker)

These mirror backend constraints. Enforce pre-submit so the user never sees a 422 for a
preventable error.

| Condition | Required field |
|---|---|
| always | `frequency`, `interval ≥ 1`, `dtstart` |
| `frequency === 'weekly'` | `weekdays.length ≥ 1` |
| `frequency === 'monthly' && monthly_type === 'day'` | `day_of_month` in `1..31` |
| `frequency === 'monthly' && monthly_type === 'weekday'` | `nth_weekday` in `{1, 2, 3, 4, -1}` AND `weekday` in `0..6` |
| boundary chosen | exactly zero or one of `{ until, count }` set (mutual exclusion) |
| `count` provided | `count ≥ 1` |
| `until` provided | `until > dtstart` |

**Frequency change reset rule:** switching `frequency` clears the conditional fields (`weekdays`,
`day_of_month`, `monthly_type`, `nth_weekday`, `weekday`) to avoid stale combinations.

## Appendix D — i18n keys (flat `recurringevents.*` prefix)

All copy referenced by the UX doc, mapped to concrete keys. Add these to the EN message file
first, then translate to IT and DE before launch. Run `pnpm paraglide:compile` after each batch.

**Wizard**

- `recurringevents.wizard.title`
- `recurringevents.wizard.stepAHeading` — "Template event"
- `recurringevents.wizard.stepBHeading` — "Recurrence & series settings"
- `recurringevents.wizard.anchorHelper` — "This is also the anchor date for the recurrence…"
- `recurringevents.wizard.seriesNameLabel`, `.seriesDescriptionLabel`
- `recurringevents.wizard.timezoneHelper` — "Times are anchored to the UTC start…"
- `recurringevents.wizard.autoPublishLabel`, `.autoPublishOnHelper`, `.autoPublishOffHelper`
- `recurringevents.wizard.generationWindowLabel`, `.generationWindowHelper`
- `recurringevents.wizard.next`, `.back`, `.create`, `.createPending`
- `recurringevents.wizard.createdToast`

**RecurrencePicker**

- `recurringevents.picker.frequency.daily|weekly|monthly|yearly`
- `recurringevents.picker.intervalLabel`
- `recurringevents.picker.weekdayShort.0..6` — Mon..Sun
- `recurringevents.picker.weekdayLong.0..6`
- `recurringevents.picker.monthlyType.day`, `.weekday`
- `recurringevents.picker.dayOfMonthLabel`
- `recurringevents.picker.ordinal.1..4`, `.ordinal.last`
- `recurringevents.picker.boundary.none`, `.until`, `.count`
- `recurringevents.picker.untilLabel`, `.countLabel`
- `recurringevents.picker.validation.weekdaysRequired`, `.dayOfMonthRequired`,
  `.nthWeekdayRequired`, `.boundaryMutex`, `.untilAfterStart`

**RecurrenceSummary** (for each branch of `formatRecurrence`; keys take placeholders)

- `recurringevents.summary.daily` — "Every day" / "Every {n} days"
- `recurringevents.summary.weekly` — "Every {weekdays}" / "Every {n} weeks on {weekdays}"
- `recurringevents.summary.monthlyDay` — "The {ordinal} of every month" / "Every {n} months on day {day}"
- `recurringevents.summary.monthlyWeekday` — "The {ordinal} {weekday} of every month"
- `recurringevents.summary.yearly`
- `recurringevents.summary.boundary.until` — "… until {date}"
- `recurringevents.summary.boundary.count` — "… for {n} occurrences"
- `recurringevents.summary.boundary.none` — "… with no end date"

**Series dashboard**

- `recurringevents.dashboard.title`
- `recurringevents.dashboard.statusActive`, `.statusPaused`
- `recurringevents.dashboard.autoPublishOn`, `.autoPublishOff`
- `recurringevents.dashboard.horizonLabel` — "Scheduled up to {date}"
- `recurringevents.dashboard.actions.seriesSettings`, `.editTemplate`, `.editRecurrence`,
  `.cancelOccurrence`, `.generateNow`, `.pause`, `.resume`
- `recurringevents.dashboard.upcomingHeading`, `.pastHeading`, `.exdatesHeading`
- `recurringevents.dashboard.repairSeriesBanner`

**OccurrenceRow**

- `recurringevents.row.modifiedBadge` — "Manually edited"
- `recurringevents.row.driftedBadge` — "Off-schedule"
- `recurringevents.row.weekIndex` — "Week {n}"
- `recurringevents.row.cancelAction`

**Drift banner + bulk cancel**

- `recurringevents.drift.banner.title` — "{n} occurrence(s) off the current schedule"
- `recurringevents.drift.banner.body` — brief explanation of drift
- `recurringevents.drift.banner.reviewAnchor` — "Review stale dates"
- `recurringevents.drift.banner.bulkCancelCta` — "Cancel all {n} stale dates"
- `recurringevents.drift.bulkDialog.title`
- `recurringevents.drift.bulkDialog.explainer` — refunds caveat + "cannot be undone"
- `recurringevents.drift.bulkDialog.armCheckbox` — "I understand these events will be cancelled and tickets refunded."
- `recurringevents.drift.bulkDialog.rowStatus.pending|inFlight|done|error`
- `recurringevents.drift.bulkDialog.confirm`, `.cancel`
- `recurringevents.drift.bulkDialog.partialFailure` — "{done}/{total} cancelled; {remaining} left. Retry?"
- `recurringevents.drift.bulkDialog.successToast` — "{n} dates cancelled"

**ExdatesChipList**

- `recurringevents.exdates.createOneOffAction`
- `recurringevents.exdates.semanticHelper`

**Dialogs**

- `recurringevents.templateDialog.title`, `.notEditableHelper`
- `recurringevents.templateDialog.propagate.none.title|body`
- `recurringevents.templateDialog.propagate.futureUnmodified.title|body` (marked "recommended")
- `recurringevents.templateDialog.propagate.allFuture.title|body` (destructive tone)
- `recurringevents.templateDialog.applyButton`
- `recurringevents.recurrenceDialog.title`, `.dtstartReadOnlyHelper`, `.cadenceChangeConfirm`
- `recurringevents.cancelOccurrenceDialog.title`, `.body`, `.confirm`
- `recurringevents.generateNow.untilLabel`, `.successToast` (plural), `.upToDateToast`
- `recurringevents.pauseResume.pauseConfirm`, `.pauseConfirmBody`
- `recurringevents.seriesSettings.title`

**Errors**

- `recurringevents.error.422Generic`, `.400Generic`, `.networkRetry`

## Appendix E — Template event admin access

The UX doc says "If a stale cache surfaces an event with `is_template === true`, treat as 404."
This rule applies to **attendee-facing** routes only. Admin editing of the template (reached via
`TemplateEditDialog` *or* — if ever needed for fields outside `TemplateEditSchema` — via the
regular event editor) must continue to work.

**Implementation:**

1. In `src/routes/(public)/events/[org_slug]/[event_slug]/+page.server.ts`, add an early
   `error(404)` when the loaded event has `is_template === true`. Same for any attendee dashboard
   route that surfaces an event detail.
2. Do **not** add this guard to admin routes under `src/routes/(auth)/org/[slug]/admin/events/
   [event_id]/…`. The template event's ID may be linked from the series dashboard ("View template"
   link) for organisers who want to change per-occurrence fields the template schema doesn't
   cover (e.g. `rsvp_before` offsets — see `TemplateEditSchema` docstring).
3. Sitemap / SSR feed generation must skip `is_template=true` events. The public
   `EventSeriesRetrieveSchema` already excludes the template via `for_user()` — audit
   `src/routes/sitemap.xml/+server.ts` to confirm the event list it iterates over inherits that
   filter.

## Appendix F — Permissions and 403 handling

All recurring-event admin endpoints require `OrganizationPermission("create_event")` or
`("edit_event_series")`. The admin layout already enforces overall admin access, but specific
actions can still 403 for lower-privileged staff (e.g. a staff member with only `view_event`).

**Pattern:** every mutation in the recurring flow should handle `403` explicitly by showing the
backend's `detail` in a toast and leaving local state unchanged. A generic helper already exists
in the project (`handleApiError` or similar — check `src/lib/utils/`); if not, add one in
Phase 0.

Role-gated UI hints:

- Header action buttons in `SeriesHeaderCard` should be `disabled` when the current user lacks
  the relevant permission. Permission data is on `$page.data.organization.my_role` (or similar —
  verify at implementation time). Show a tooltip explaining why.
- The "New recurring series" CTA on the series list is hidden if the user lacks `create_event`.

## Appendix G — Concrete FE edits to existing files

These are the minimum changes outside new files. A fresh session should expect to touch only
these existing paths.

1. `src/routes/(auth)/org/[slug]/admin/event-series/+page.svelte` — change the primary CTA from
   `goto(.../new)` to `goto(.../new-recurring)` and add a secondary link underneath pointing at
   the existing `.../new`. Update list-row clicks to navigate to
   `.../event-series/{series_id}/` (the new dashboard) instead of `.../edit`.
2. `src/routes/(auth)/org/[slug]/admin/event-series/[series_id]/edit/+page.server.ts` — replace
   body with a 301 redirect to `../?settings=open`.
3. `src/routes/(public)/events/[org_slug]/[event_slug]/+page.server.ts` — add the
   `is_template → 404` guard (Appendix E §1).
4. `src/routes/sitemap.xml/+server.ts` — verify template events are excluded.
5. i18n: add all keys from Appendix D.

No changes expected to `EventEditor.svelte`, `EssentialsStep.svelte`, `DetailsStep.svelte` —
they're reused via composition only. If a wizard-specific UX tweak is needed, extract it behind
a prop rather than branching inside those components.

## Appendix H — Out of scope for this plan

Calling these out to prevent scope creep mid-implementation:

- **Series deletion UI** — not in scope. A delete affordance may be added later under
  `SeriesSettingsDialog`, but the UX doc copy ("This deletes the series, its template, and all
  scheduled occurrences…") should drive its own review before shipping.
- **Rebase series** (atomic cancel-old-cadence + regenerate under new rule) — backend PR #378
  ships detection only, not a rebase endpoint. If the team wants this later, file a separate
  backend issue.
- **Per-occurrence ticketing tier customisation** — tiers attach to the template event today;
  if an organiser needs occurrence-specific tiering, they edit the materialised event directly
  (flipping `is_modified`). No new UI.
- **True `exdates` reinstate** — blocked on backend; chip action creates a one-off event
  (Appendix, open decision #4).
- **Series-level analytics / reporting** — out of scope; past occurrences list in the dashboard
  is the only reporting surface for now.
- **Venue rebinding on the template** — `TemplateEditSchema` excludes `venue_id` on purpose.
  The dedicated endpoint described in the schema docstring does not yet exist; don't build UI for
  it.

## Readiness checklist (for a fresh session)

Tick all of these before opening Phase 1:

- [ ] Backend PRs #369 and #378 both merged to `main` and deployed to the local backend.
- [ ] `pnpm generate:api` run; `sdk.gen.ts` contains
      `organizationadminrecurringeventsCreateRecurringEvent`,
      `organizationadminrecurringeventsGetSeriesDetail`, and
      `organizationadminrecurringeventsGetSeriesDrift` (or equivalent — Appendix A).
- [ ] `types.gen.ts` contains `RecurringEventCreateSchema`, `EventSeriesRecurrenceDetailSchema`,
      `EventSeriesDriftSchema`, `RecurrenceRuleSchema`, `TemplateEditSchema`, `PropagateScope`,
      `Frequency`, `MonthlyType`.
- [ ] `RECURRING_EVENTS_UX.md` and this plan read end-to-end.
- [ ] `COMMON_FIXES.md` skimmed (TanStack Query / Svelte 5 runes patterns).
