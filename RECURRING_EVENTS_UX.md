
# Recurring Events — UX/UI Flows

Backend reference: PR [letsrevel/revel-backend#369](https://github.com/letsrevel/revel-backend/pull/369), closes issue
[#118](https://github.com/letsrevel/revel-backend/issues/118). API client is auto-generated — run
`pnpm generate:api` after the backend ships.

## Mental model

An organisation creates an **event series** with a recurrence rule. The backend maintains a rolling
window (default 8 weeks, max 52) of real `Event` rows, each independently ticketable / RSVP-able.
A **template event** (invisible in public listings) is the blueprint; each **occurrence** is a
standalone `Event`. Edits propagate from the template to future occurrences on request.

```
Organization → EventSeries → RecurrenceRule (weekly, monthly, …)
                   │
                   ├── Template Event (is_template=true, hidden from attendees)
                   │
                   └── Occurrence 1, Occurrence 2, …  (is_template=false, real tickets)
```

Key state flags to surface in the UI:

| Field on `Event` | Meaning | UI implication |
|---|---|---|
| `is_template=true` | Template blueprint | Treat as 404 if it ever surfaces to an attendee. |
| `is_modified=true` | Organiser edited this occurrence directly | Badge it: "Manually edited — excluded from future-unmodified propagation". |
| `occurrence_index` | 0-based position in the series | Use for "Week 4 of …", series dashboards. |

On `EventSeries`:

| Field | Meaning |
|---|---|
| `is_active` | Series is generating (true) / paused (false). |
| `auto_publish` | New occurrences are OPEN (true) or DRAFT (false, awaiting organiser publish). |
| `generation_window_weeks` | How far ahead we materialise (1–52). |
| `last_generated_until` | The horizon cursor; occurrences exist up to this datetime. |
| `exdates` | ISO 8601 strings — dates the organiser cancelled. Parse client-side. |
| `recurrence_rule` | Structured rule (see below); do **not** render `rrule_string` raw. |
| `template_event` | Minimal representation for preview; do not link users to it. |

## API surface (admin)

All paths are under `/organization-admin/{slug}`. All endpoints require
`OrganizationPermission("create_event")` or `("edit_event_series")` — surface 403 copy if the
current role can't perform the action.

| Flow | Method + path | Request schema | Response |
|---|---|---|---|
| Create series | `POST /create-recurring-event` | `RecurringEventCreateSchema` | `201 EventSeriesRecurrenceDetailSchema` |
| Edit template + propagation | `PATCH /event-series/{id}/template?propagate=none\|future_unmodified\|all_future` | `TemplateEditSchema` (`extra="forbid"`) | `200 EventSeriesRecurrenceDetailSchema` |
| Edit recurrence / series settings | `PATCH /event-series/{id}/recurrence` | `EventSeriesRecurrenceUpdateSchema` (partial) | `200 EventSeriesRecurrenceDetailSchema` |
| Cancel single occurrence | `POST /event-series/{id}/cancel-occurrence` | `{ occurrence_date: AwareDatetime }` | `200 EventSeriesRecurrenceDetailSchema` |
| Manual generate | `POST /event-series/{id}/generate` | `{ until?: AwareDatetime }` (optional body) | `200 EventDetailSchema[]` |
| Pause | `POST /event-series/{id}/pause` | — | `200 EventSeriesRecurrenceDetailSchema` |
| Resume | `POST /event-series/{id}/resume` | — | `200 EventSeriesRecurrenceDetailSchema` |

## API surface (attendee-facing, pre-existing)

| Flow | Method + path |
|---|---|
| Discover series | `GET /event-series/` |
| Series detail (public) | `GET /event-series/{id}` or `GET /event-series/{org_slug}/{series_slug}` |
| Check follow status | `GET /event-series/{id}/follow` |
| Follow | `POST /event-series/{id}/follow` |
| Update follow prefs | `PATCH /event-series/{id}/follow` |
| Unfollow | `DELETE /event-series/{id}/follow` |

Note: the **public** `EventSeriesRetrieveSchema` does **not** include `recurrence_rule`,
`template_event`, `exdates`, or `last_generated_until`. Attendees see the list of upcoming
occurrences via the normal events list filtered by `event_series_id`. Admin gets the full
`EventSeriesRecurrenceDetailSchema` from admin endpoints.

## Flows to build

### 1. "Create recurring event" wizard

Two-step flow on top of the existing event editor:

**Step A — Event template.** Reuse the existing event form. The server will force `status=draft`
and reject anything else with a 422. **Hide the status selector entirely in this flow.** Use the
form's `start` as the `dtstart` anchor (suggest-on-change below the recurrence picker).

**Step B — Recurrence + series settings.**
- Series name (prefill from event name), optional description.
- Recurrence picker with conditional UI per `frequency`:
  - **Daily / Weekly / Monthly / Yearly**
  - `interval` (every N frequency-units). Min 1.
  - **Weekly**: weekday multiselect (0=Mon … 6=Sun).
  - **Monthly**: mode picker with two sub-modes:
    - *Day of month* → `day_of_month` (1–31).
    - *Nth weekday* → `nth_weekday` (1, 2, 3, 4, or -1 for "last") + `weekday` (0–6).
  - Boundaries (radio): **None** / **Until date** (`until`) / **N occurrences** (`count`).
    `until` and `count` are mutually exclusive — enforce in UI before submit.
- Advanced (collapsed by default): `auto_publish` toggle (default off), `generation_window_weeks`
  slider (default 8, max 52).
- `timezone` is currently advisory — keep it readable in the form but show a helper: *"Times are
  anchored to the UTC start you chose. DST-aware recurrence is coming in a future release."*

Submit → `POST /create-recurring-event`. On success, navigate to the series admin dashboard (see
flow 2).

**Error cases to handle:**
- 422 from `extra="forbid"` on the event payload: surface the field-level error inline.
- 422 `"Template events must have status='draft'"`: shouldn't happen if UI hides the selector, but
  catch it and show a toast as a last resort.
- 400 with `detail`: show banner; most 400s are business-rule violations the user should see verbatim.

### 2. Series admin dashboard

Route suggestion: `/org/:slug/series/:id/manage`.

Header card:
- Name, description, org logo.
- Status chip: **Active** (green) / **Paused** (grey). Click → pause/resume actions.
- Auto-publish badge: **Auto-publish on** / **Review each draft**.
- Horizon line: *"Scheduled up to Saturday, 17 June"* (from `last_generated_until`).
- Primary actions: Edit template · Edit recurrence · Cancel occurrence · Generate now · Pause/Resume.

Body:
- Human-readable recurrence summary (derive from the structured fields — never render
  `rrule_string` raw). Examples:
  - Weekly: *"Every Monday"* · *"Every 2 weeks on Tuesday and Thursday"*.
  - Monthly: *"The 15th of every month"* · *"The 2nd Tuesday of every month"* · *"The last Friday…"*.
  - Daily: *"Every day"* · *"Every 3 days"*.
  - Append boundary: *"… until 31 Dec 2026"* or *"… for 12 occurrences"* or *"… with no end date"*.
- Upcoming occurrences list — same event card component used elsewhere, with:
  - `is_modified` badge when true.
  - Ticket-sold / capacity summary from existing event fields.
  - Per-row "Cancel this date" quick action (calls the cancel-occurrence endpoint).
- Past occurrences (collapsed / paginated) — for reporting.
- Cancelled dates (`exdates`) rendered as chips — click to re-enable (future; not yet supported
  server-side, so keep read-only).

### 3. "Edit template" modal

Schema: `TemplateEditSchema` — **only** the fields it exposes. `extra="forbid"` means unknown
fields 422. Allowed fields:

`name`, `description`, `invitation_message`, `event_type`, `visibility`, `address_visibility`,
`address`, `max_attendees`, `max_tickets_per_user`, `waitlist_open`, `requires_ticket`,
`requires_full_profile`, `potluck_open`, `accept_invitation_requests`,
`public_pronoun_distribution`, `can_attend_without_login`.

**Explicitly not editable here** (surface the reasons as UI helpers where relevant):
- `start`, `end`, `rsvp_before`, `apply_before` — per-occurrence dates/deadlines; edit on the
  occurrence itself (that flips `is_modified`).
- `status` — templates are always DRAFT. Use `auto_publish` on the series instead.
- `venue_id`, `slug`, `event_series_id` — structural; not editable on the template.
- `location` (PostGIS point) — not exposed. Updating `address` does **not** re-geocode. If
  coordinates matter, update the template's `location` through a future dedicated endpoint.

After submit, show a **propagation picker** (this is the crucial step):

1. **Only this template** — "Saves changes to the template. New occurrences will pick them up; existing ones are unchanged." (`propagate=none`)
2. **Future occurrences that haven't been manually edited** *(recommended)* — "Apply to upcoming occurrences except those you've edited directly." (`propagate=future_unmodified`)
3. **All future occurrences, including manually edited ones** — destructive style (red/warning): "Overwrites every upcoming occurrence, including your manual edits. This cannot be undone." (`propagate=all_future`)

On 400 `ValueError` from the service, show `detail` verbatim — the service uses it for business-rule
messages ("Series has no template", etc.).

### 4. "Edit recurrence" modal

Schema: `EventSeriesRecurrenceUpdateSchema`. All fields optional. Send only what the user changed
(`model_dump(exclude_unset=True)` equivalent on the client side).

- Recurrence fields: same UI as the create wizard, but **`dtstart` is not editable**. Show the
  current anchor as read-only text with a helper: *"The anchor date can't be changed here — it
  would require rescheduling every occurrence and handling sold tickets. [Contact support] if you
  need this."*
- Series settings: `auto_publish`, `generation_window_weeks`.

**Important copy:** Changing cadence clears the generation cursor so the next daily run re-fills
forward, but **already-scheduled future occurrences stay on their old dates**. Show a confirmation
dialog:

> "Changing the schedule only affects occurrences not yet created. Upcoming occurrences already on
> the calendar keep their dates — you can cancel them individually if needed."

### 5. "Cancel occurrence"

Two entry points:
- Quick action on an occurrence row in the dashboard (row-level).
- Modal with datetime picker (general).

Payload: `{ occurrence_date: AwareDatetime }` — must be an exact match against a scheduled start.

Backend behaviour (make this explicit in the confirmation):
- Always adds the date to `exdates` (prevents re-generation on the next beat run).
- If the occurrence is already materialised, sets `status=CANCELLED` on that event. Existing
  tickets for that event follow the normal cancellation refund flow.

Copy:
> "Cancel this date only — the series keeps running. If the event has sold tickets, holders will be
> notified and refunded per your refund policy."

### 6. "Generate now" (manual)

Button in the series dashboard. Optional datetime picker for `until` override (defaults to the
configured window).

Response is `EventDetailSchema[]`. States:
- Non-empty → success toast: *"N new occurrences scheduled through {date}."* Refresh the upcoming list.
- Empty → neutral: *"Already up to date — no new occurrences to generate."*

### 7. Pause / Resume

Simple button toggle. Confirmation required for Pause.

**Pause copy:** "Stop creating new occurrences. Existing events stay scheduled — cancel them
individually if you need to."

**Resume copy:** "Resume automatic scheduling. The next occurrence will appear on the next run
(once per day). Gaps from the paused period will not be back-filled."

### 8. Series follow (attendee side, already shipped)

No new work on the data side — `GET/POST/PATCH/DELETE /event-series/{id}/follow` already exist and
are wired. One copy change to consider:

- When `series.auto_publish === true`, attendees who follow the series receive a **digest**
  notification (`SERIES_EVENTS_GENERATED`) — one message for N newly scheduled events — rather than
  N individual `EVENT_OPEN` notifications. Surface this in the follow dialog:

  > "You'll get one heads-up when new dates are added, not one per event."

  When `auto_publish === false`, followers get the usual per-event notification as each draft is
  published by the organiser. Same dialog copy for both is fine; the digest is a backend optimisation.

## Edge cases FE must handle

- **Templates are hidden.** If a stale cache surfaces an event with `is_template === true`, treat
  as 404. The public `for_user()` queryset already excludes them; this is defence-in-depth.
- **`exdates` is `string[]` (ISO 8601 UTC).** Parse client-side with `new Date(s)`. Don't trust any
  helper typing.
- **Timezone advisory.** Same helper copy used in create + edit flows ("anchored to the UTC start,
  DST-aware recurrence coming later"). Do not render timezone-converted local times until the
  backend actually handles DST transitions.
- **`dtstart` immutable on PATCH recurrence.** Gate the input as read-only; the update schema drops
  this field on purpose.
- **Validation shapes.**
  - 422 → schema-level; render field errors inline from `errors[]`.
  - 400 → service-level `ValueError`; render `detail` as a banner/toast.
- **Deletion cascades.** Deleting the series cascades to template and all materialised events via
  `event_series` CASCADE. In any delete-series UI, the confirmation must be unambiguous:

  > "This deletes the series, its template, and all scheduled occurrences. Tickets sold for those
  > events will be cancelled and refunded."

- **`auto_publish` toggled true → false** does **not** un-publish existing OPEN occurrences. Copy on
  the toggle should note: *"Turning this off only affects new occurrences — current ones keep their
  status."*
- **Long series.** `generation_window_weeks` is capped at 52. Guard the slider client-side (the
  backend enforces it, but show a helper before the user sees a 422).
- **Series with no rule or template.** If the API ever returns a series where `recurrence_rule` or
  `template_event` is null (legacy data), show a banner with a "Repair series" CTA pointing to
  support. Do not show the recurrence summary or action buttons that would fail.
- **Concurrent edits.** The admin endpoints are serialised by row locks on the backend; if two
  staff save simultaneously, one will get the stored value back. Consider refreshing the admin
  dashboard after every mutating request to reflect the authoritative state.

## Copy / terminology rules

- Use **series** as the noun, not "recurring event". The user creates **a series**, manages **a
  series**, cancels **an occurrence of a series**.
- Distinguish **template** (blueprint, DRAFT-only, organiser-only) from **occurrence** (real,
  ticketable event) in tooltips and help text. The API uses "template" — mirror it.
- Always explain `auto_publish` implications in plain language:
  - **On**: *"New dates go live the moment they're created."*
  - **Off**: *"New dates are drafts — you review and publish each one."*
- The generation window is a rolling horizon, not a hard end. Don't call it a "limit". Use:
  *"Occurrences are scheduled up to N weeks ahead. New ones appear automatically each day."*
- Never render the raw `rrule_string` to an end user — it's RFC 5545, not UX.

## Component checklist

- [ ] `RecurrencePicker.svelte` — structured rule editor; used in create + edit flows.
- [ ] `RecurrenceSummary.svelte` — human-readable renderer from structured fields.
- [ ] `SeriesDashboard.svelte` (page) — the admin landing after create.
- [ ] `SeriesHeaderCard.svelte` — status, auto-publish, horizon, primary actions.
- [ ] `TemplateEditDialog.svelte` — edit template + propagation picker.
- [ ] `RecurrenceEditDialog.svelte` — recurrence + series settings; `dtstart` read-only.
- [ ] `CancelOccurrenceDialog.svelte` — datetime confirm + tickets-sold warning.
- [ ] `GenerateNowButton.svelte` — optional `until` picker, handles empty result.
- [ ] `PauseResumeButton.svelte` — toggle with confirmation.
- [ ] `OccurrenceRow.svelte` — shared row component with `is_modified` badge and quick-cancel.
- [ ] i18n: add `recurring_events` namespace; cover all copy above in EN + IT + DE.

## Release checklist

- [ ] `pnpm generate:api` after backend merge.
- [ ] Accessibility pass on the recurrence picker (keyboard nav for weekday multiselect, nth-weekday
      sub-selector).
- [ ] Mobile review for the dashboard (horizon line, action sheet instead of button row on narrow
      viewports).
- [ ] Playwright: create series → dashboard → edit template with propagation → cancel one → pause →
      resume happy path.
- [ ] SEO: public `GET /event-series/{slug}/{slug}` is SSR (already supported by existing series
      routes). Series detail should include upcoming dates in the page for indexing.

## Open questions for design

- How do we visually distinguish a manually edited occurrence in the upcoming list beyond a badge?
  (Tint? Side-bar accent?)
- Cancelled-dates chips — read-only for now. Do we want a "reinstate" flow later, or keep it as
  "cancel then regenerate manually"?
- When the organiser changes cadence and mixed old/new dates remain, should the dashboard surface a
  "Review upcoming occurrences that don't match the new schedule" banner with a bulk-cancel CTA?
  Backend doesn't support bulk-cancel yet, but the UX prompt would be useful.
