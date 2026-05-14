# Subscriptions Phase 1 — Frontend UI Design

**Status:** Approved (brainstorming complete)
**Date:** 2026-05-14
**Branch:** `feature/subscriptions-phase1-ui`
**Backend dependency:** [`revel-backend` PR #397](https://github.com/letsrevel/revel-backend/pull/397) — "Phase 1 — foundation + OFFLINE membership subscriptions"

## Context

Backend PR 397 ships Phase 1 of membership subscriptions — entirely staff-managed, no Stripe. It introduces:

- `MembershipSubscriptionPlan` scoped to a `MembershipTier` (multiple plans per tier, e.g. Monthly + Annual)
- `MembershipSubscription` per `(user, organization)` with statuses `pending → active → past_due → expired`, plus `paused` and `cancelled`
- `MembershipPayment` — manually recorded by staff
- Lifecycle actions: cancel (immediate or at-period-end), pause, resume, refund
- A signal that syncs `OrganizationMember.tier + status` from the active subscription
- New permission `manage_subscriptions` (owners ✓, staff ✓ default, member ✗)

Member-facing endpoints are read-only:
- `GET /api/me/membership-subscriptions`
- `GET /api/me/organizations/{org_id}/subscription`

Member self-serve subscribe/cancel/pay is explicitly out of scope for Phase 1 and will land via backend PR 403 (Phases 2-4: Stripe ONLINE, lifecycle changes, dunning, metrics).

This spec covers the frontend surface for Phase 1 only. It walls off cleanly so PR 403's additions can be layered on without rework.

## Goals

1. Give staff a coherent admin surface to manage plans, subscriptions, and payments without leaving the existing `/admin/members` shell.
2. Give members a clear read-only view of their memberships at `/account/memberships` and on each org's public page.
3. Keep the design extensible so Phase 2's member-initiated actions (subscribe, change plan, billing portal) slot in without architectural churn.

## Non-goals

- Stripe / online payments (Phase 2 / PR 403)
- Member-initiated subscribe, cancel, change-plan, revive
- Subscription metrics dashboards
- Plan price migration tooling
- Editing `membership_grace_period_days` / `membership_refund_policy` (backend doesn't expose these in any schema yet — see Known Gaps)

## Information architecture

### Admin (`/admin/members`)

Existing tabbed page: `Members | Staff | Tiers | Requests` (+ Tokens). Two changes:

1. **Inside `TiersTab`** — each tier card gains a `PlansList` section showing plans as a small grid with inline add/edit/archive/delete.
2. **New `SubscriptionsTab`** — sibling tab. Paginated list (search + status filter). Click row → drawer with status header, lifecycle actions, payments table.

### Member

1. **New `/account/memberships`** — sibling of existing `/account/invoices`, `/account/profile`, etc. Lists all subscriptions across orgs.
2. **New `OrgMembershipInline` card** — mounted on `/org/[slug]` (the public org page). Visible only when logged-in user has a non-terminal subscription in that org. 404 silently hides.

## Component layout

```
src/lib/components/members/
  PlansList.svelte                 # inline plan grid inside a tier card
  PlanFormModal.svelte             # create/edit plan
  PlanDeleteConfirm.svelte         # delete vs archive copy
  SubscriptionsTab.svelte          # the new tab
  SubscriptionRow.svelte           # desktop table row
  SubscriptionCard.svelte          # mobile card
  SubscriptionDrawer.svelte        # right-side drawer (sheet on mobile)
  SubscriptionCreateModal.svelte   # member combobox + plan select + optional initial payment
  RecordPaymentModal.svelte
  CancelSubscriptionDialog.svelte  # immediate vs at-period-end
  PaymentsTable.svelte             # nested in drawer, with refund row action
  RefundPaymentDialog.svelte
  StatusBadge.svelte               # shared color-coded subscription status pill

src/lib/components/account/
  MembershipCard.svelte            # one sub on /account/memberships
  OrgMembershipInline.svelte       # "Your membership" card for /org/[slug]
```

Modified routes:

```
src/routes/(auth)/org/[slug]/admin/members/+page.svelte    # add Subscriptions tab
src/lib/components/members/TiersTab.svelte                 # mount PlansList per tier
src/routes/(auth)/account/memberships/+page.svelte         # NEW (+page.ts, CSR-only)
src/routes/(public)/org/[slug]/+page.svelte                # mount OrgMembershipInline
```

## API integration

API client is regenerated from `revel-backend/.artifacts/openapi.json` (`pnpm generate:api`). All types/SDK calls are auto-generated. No hand-written API code.

### TanStack Query keys

```ts
['organization', slug, 'membership-tiers']                        // already exists
['organization', slug, 'tier', tierId, 'plans']                   // NEW
['organization', slug, 'subscriptions', { search, status, page }] // NEW (paginated)
['organization', slug, 'subscription', subId]                     // NEW (detail)
['organization', slug, 'subscription', subId, 'payments']         // NEW (see Known Gaps #1)
['me', 'memberships']                                             // NEW (paginated)
['me', 'org', orgId, 'subscription']                              // NEW (404 = no sub)
```

### Mutations & invalidation

| Mutation | Invalidates |
|---|---|
| Plan create/update/archive/delete | `['organization', slug, 'tier', tierId, 'plans']` |
| Create subscription | `subscriptions` list + `members` list (signal updates tier) |
| Record payment | optimistic insert into payments list; `subscription` detail + `subscriptions` list (status may transition) |
| Cancel / Pause / Resume | optimistic status update on drawer header + row; invalidate `subscription` + `subscriptions` list |
| Refund payment | `subscription` + `subscription payments` |

### Validation (zod)

- **Plan form:** `name` (1-255), `price` ≥ 0, `currency` in `Currencies` enum, `period_unit` ∈ {month, year}, `period_count` 1-120, `is_active` bool.
- **Create subscription:** `plan_id` UUID, `user_id` UUID, optional `initial_payment_amount` (if set, requires `initial_payment_currency` — mirrors backend `_validate_initial_payment`).
- **Record payment:** `amount` ≥ 0, `currency` required, `status` default `succeeded`.
- **Cancel:** `immediate` boolean (default `false`).

### Currency & price formatting

Reuse the existing `Currencies` enum + currency picker (aligned with backend per fix 1.50.2). Plans render as:

- `€10.00 / month` (period_count=1, period_unit=month)
- `€99.00 / year` (period_count=1, period_unit=year)
- `€20.00 / 3 months` (period_count=3, period_unit=month)

## Status badge

Shared `StatusBadge.svelte` used in admin row, drawer header, and member card.

| Status | Color | Label |
|---|---|---|
| `active` | green | "Active" |
| `pending` | blue | "Pending" |
| `past_due` | amber | "Past due" (tooltip: payment expected by grace end) |
| `paused` | gray | "Paused" |
| `cancelled` | muted | "Cancelled" (+ "ends {date}" if `cancel_at_period_end` and `current_period_end > now`) |
| `expired` | red/muted | "Expired" |

All badges meet WCAG 2.1 AA (4.5:1 contrast). `aria-label` echoes the visible label for screen readers.

## Admin: SubscriptionsTab

**List view** (paginated 20/page):

```
[search input]  [status filter ▾]                     [+ Create subscription]

User                    Plan                Status      Period end    ⋮
Jane Doe (jane@x.com)   Gold Monthly        Active      Jun 14        ⋮
John Roe (john@x.com)   Annual              Past due    Jul 01        ⋮
…
```

- **Search** debounced 300ms, hits `?search=` on the list endpoint (backend searches `email`, `first_name`, `last_name`, `preferred_name`, `status`).
- **Status filter** is a frontend-side filter on the page (cheap, since 20/page); does NOT send a backend param (the endpoint doesn't accept one in Phase 1). For larger orgs we revisit and add a backend filter in a follow-up.
- **Mobile** → cards instead of table (consistent with existing codebase pattern).

**Row → Drawer**

Tapping a row opens `SubscriptionDrawer` (sheet on mobile, right drawer on desktop ~480px).

## Admin: SubscriptionDrawer

```
[X close]
[Avatar] Jane Doe · jane@x.com
Plan: Gold Monthly · €10.00 / month
Status: [Active]  Renews Jun 14, 2026

[Record payment]  [Pause]  [Cancel ▾]

── Payments ───────────────────────────────
Date       Amount   Status      Notes    ⋮
May 14     €10.00   Succeeded   —        ⋮ Refund
Apr 14     €10.00   Succeeded   —        ⋮
```

### Action availability matrix

| Status | Record payment | Pause | Resume | Cancel |
|---|---|---|---|---|
| `pending` | ✓ | — | — | ✓ |
| `active` | ✓ | ✓ | — | ✓ |
| `past_due` | ✓ | — | — | ✓ |
| `paused` | — | — | ✓ | ✓ |
| `cancelled` | — | — | — | — |
| `expired` | — | — | — | — |

Encoded as a pure helper: `getAvailableActions(sub: SubscriptionSchema): ActionSet` in `src/lib/utils/subscriptions.ts`. Table-driven test coverage.

### Cancel dialog

```
Cancel subscription
○ At the end of the current period (Jun 14, 2026)
   The member keeps access until then.
○ Immediately
   Access is revoked now. No refund is issued automatically.
[Keep subscription]   [Confirm cancellation]
```

Default is `at-period-end`. Immediate requires an extra checkbox confirmation to prevent fat-fingers.

### Record payment modal

Fields: `amount` (numeric), `currency` (preselected from plan), `status` (default `succeeded`, allow `pending`/`failed`), `notes` (textarea, optional).

If user picks a currency different from the plan's currency, show inline warning: "This subscription is billed in {plan_currency} — recording in {selected} is unusual." Backend allows the override.

On success: optimistic insert at top of payments table; refetch `subscription` detail (period_end may advance and status may transition).

### Refund row action

Dialog with notes textarea. Copy: "This records the refund for bookkeeping. Issue the actual refund out-of-band (cash/bank transfer/Stripe dashboard)."

### Optimistic updates

For cancel/pause/resume:
1. Update sub object in `['organization', slug, 'subscription', subId]` cache + matching row in list cache.
2. On settle, invalidate both to reconcile with server (period dates etc.).
3. On error, rollback + error toast with backend message.

## Admin: PlansList (inside TiersTab)

Each tier card gains a "Plans" section:

```
┌─ Gold tier ────────────────────────────────┐
│ Description...                              │
│                                             │
│ Plans                                       │
│   ┌─────────────┐ ┌─────────────┐ ┌──────┐ │
│   │ Monthly     │ │ Annual      │ │  +   │ │
│   │ €10.00/mo   │ │ €99.00/yr   │ │ Add  │ │
│   │ Active      │ │ Active      │ │      │ │
│   │ [✎] [↓ arch]│ │ [✎] [↓ arch]│ │      │ │
│   └─────────────┘ └─────────────┘ └──────┘ │
│                                             │
│ [Edit tier]  [Delete]                       │
└─────────────────────────────────────────────┘
```

- **Inactive plans** displayed greyed out, with "Archived" badge.
- **Delete plan** blocked if subscriptions reference it (backend rejects). On the friendly error UI: "This plan has subscribers and can't be deleted — archive it instead." Offer a one-click archive.
- **Mobile:** grid collapses to single column.

## Admin: Create subscription modal

```
Create subscription

User         [type to search members…]
             ↳ Jane Doe (jane@x.com)
               John Roe (john@x.com)

Plan         [select ▾]   (filtered to is_active=true)

[ ] Record initial payment
    ↳ Amount   [10.00]
      Currency [EUR]
      Notes    [optional]

[Cancel]                              [Create]
```

- **Member combobox** type-ahead over org members (paginated org members endpoint with search). Forces "must be a member first" workflow, matching backend's signal which never auto-creates members.
- **Plan select** filtered to `is_active=true` plans across all tiers in this org.
- **Initial payment** optional; if checkbox toggled, the amount/currency become required. Currency defaults to the selected plan's currency.

On submit:
- Backend may refuse: `BANNED` user → "{user} is banned from this organization." Duplicate active sub → "{user} already has an active subscription in this org." (Use backend error messages where available.)
- On success → close modal + open the new subscription's drawer with status reflecting the initial payment outcome (PENDING if no payment, ACTIVE if payment with `succeeded` status).

## Member: `/account/memberships`

CSR-only (no SSR — user-only data, no SEO value). Auth gate handled by `(auth)` layout.

```
My Memberships
─────────────────────────────────

Sunset Yoga                              [Active]
Gold Monthly · €10.00 / month
Next renewal: Jun 14, 2026
                                      [View org →]

Climbing Crew                            [Past due]
Annual · €99.00 / year
Period ends Jul 1, 2026
Reach out to the organizer to renew.
                                      [View org →]

Boulder Co.                              [Cancelled]
Basic Monthly · €5.00 / month
Ended May 1, 2026
                                      [View org →]
```

`MembershipCard.svelte` props: a `MySubscriptionSchema`. Status-driven date copy:

- `active` → "Next renewal: {current_period_end}"
- `active` + `cancel_at_period_end` → "Cancels on {current_period_end}"
- `pending` → "Awaiting first payment"
- `past_due` → "Period ends {current_period_end}" + "Reach out to the organizer to renew."
- `paused` → "Paused since {updated_at}"
- `cancelled` / `expired` → "Ended {cancelled_at || updated_at}"

**Empty state:**

```
You don't have any active memberships.
Memberships are managed by the organizations you belong to.

[Discover organizations →]
```

**Phase 1 has no member actions.** A "Contact organizer" link is shown if the org exposes `contact_method` (reuse existing org contact flow).

### Org name/slug enrichment

`MySubscriptionSchema` exposes `organization_id` but not name/slug/logo. We fetch organization metadata via existing org-list / org-detail queries (`useQueries` batching for the listing page; OrgMembershipInline has org context already). See Known Gap #2 — push to inline these fields server-side in PR 403 or a follow-up.

## Member: OrgMembershipInline on `/org/[slug]`

Mounted on the public org page. Visible only when:
1. User is logged in
2. `GET /me/organizations/{org_id}/subscription` returns 200

```
┌─ Your membership ──────────────────┐
│ Gold Monthly                        │
│ €10.00 / month                      │
│ [Active] · Renews Jun 14, 2026      │
│                                     │
│ Managed by Sunset Yoga staff        │
└─────────────────────────────────────┘
```

- 404 from the endpoint → render nothing (silent).
- 401 / network error → render nothing (don't break public page UX).
- Placement: right column on desktop (≥ md), top of page on mobile (just below cover art).

## Permissions

- All admin UI (Subscriptions tab, PlansList plan management, lifecycle actions) gated on `manage_subscriptions`.
- Read from `organization.permissions?.manage_subscriptions` if exposed in the admin org schema. If not yet exposed (see Known Gap #4), fall back to a staff/owner check and file a backend follow-up.
- Server enforces regardless; UI guard is for UX, not security.

## Error handling

| Action | Success toast | Specific error handling |
|---|---|---|
| Create plan | "Plan created" | Inline field errors; surface backend currency-whitelist rejection. |
| Update / Archive plan | "Plan updated" / "Plan archived" | Inline. |
| Delete plan | "Plan deleted" | "In use" → friendly copy + one-click archive CTA. |
| Create subscription | "Subscription created" + open drawer | BANNED → "{user} is banned." Duplicate active → "{user} already has an active subscription." |
| Record payment | "Payment recorded" | Inline form errors; rollback optimistic insert on failure. |
| Cancel / Pause / Resume | "Subscription {action}" | Rollback optimistic state. |
| Refund | "Payment marked as refunded" | Standard error toast. |

Toast util reused from existing project utilities. Inline form errors via Superforms.

## Accessibility

- Tab order through drawer; ESC closes; focus returns to triggering row.
- Status badges have `aria-label` matching visible text.
- Dates render as absolute strings (screen-reader friendly), not relative-only.
- All interactive controls reachable by keyboard; `:focus-visible` outlines on all.
- Color contrast ≥ 4.5:1 on every badge color (test via axe + manual).
- Drawer/sheet trap focus while open.

## Mobile

- Subscriptions list: cards on mobile, table on desktop.
- Drawer: full-width bottom sheet (90vh) on mobile, right-anchored ~480px on desktop.
- Modals: full-screen on mobile, centered card on desktop (existing project pattern).
- PlansList: single-column grid on mobile.

## i18n

New paraglide message namespaces (in `messages/en.json`):

- `orgAdmin.members.subscriptions.*` — admin tab and drawer strings
- `orgAdmin.members.plans.*` — plan management strings
- `account.memberships.*` — member-facing strings
- `subscriptions.status.*` — shared status badge labels
- `subscriptions.errors.*` — shared error copy

Compiled via `pnpm paraglide:compile` (per project convention — never `npx` directly).

## Testing

### Unit (vitest)

- `getAvailableActions(sub)` — table-driven, every status × every action.
- `formatPlanPrice(plan)` — month/year/N-month cadences across locales.
- `statusBadgeConfig(status)` — color + label mapping.
- Date-line formatter for member card variants.

### Component (@testing-library/svelte)

- `SubscriptionDrawer` — actions per status; cancel modal both modes; refund flow; optimistic state then rollback on error.
- `SubscriptionCreateModal` — combobox debounced search; required-field validation; initial-payment conditional fields.
- `PlanFormModal` — currency picker; period validation.
- `MembershipCard` — date-line variants per status; SR-readable date string.
- `OrgMembershipInline` — silent on 404 / unauth.

### E2E (playwright)

Admin happy path on `/admin/members`:
1. Tiers tab → add plan to a tier
2. Subscriptions tab → "+ Create subscription" → pick member + plan + initial payment → submit
3. Drawer opens, status `active`; record another payment; period_end advances
4. Cancel "at period end"; badge → "Active · Cancels on …"

Member path:
1. Log in as same user; `/account/memberships` → subscription card with correct status/date
2. Visit `/org/[slug]` → `OrgMembershipInline` present with status

Accessibility: axe scan on each new route + manual screen-reader pass.

### Quality gate

`make fix && make check && make test` before opening PR. Plus dev-server walkthrough at mobile + desktop viewports for both admin and member flows.

## Known backend gaps (coordinate with PR 403)

Verified against `origin/dev/subscriptions` (PR 403) on 2026-05-14.

1. **No `GET /subscriptions/{id}/payments` endpoint.** ❌ Still missing in PR 403. The drawer can only display payments observed via the create-payment mutation cache in the current session. Mitigation in Phase 1: accept empty payments on drawer open, append from successful `POST .../payments` responses, and treat the table as session-cached. **Pre-403 backend PR proposed** — see follow-up issue (low conflict risk; additive route).
2. **`MySubscriptionSchema` returns `organization_id` only** — no name/slug/logo. ❌ Still unenriched in PR 403. Member listing page must batch-fetch org metadata via existing endpoints. **Pre-403 backend PR proposed** — same follow-up issue (low conflict risk; additive fields).
3. **`Organization.membership_grace_period_days` and `Organization.membership_refund_policy` not exposed** in any read/update schema. ❌ Still unexposed; PR 403 doesn't touch org schema. No admin UI for these in Phase 1. Lower-priority backend follow-up after 403 lands.
4. **`manage_subscriptions` permission flag.** ✅ **Resolved** — defined on `PermissionMap` (default True for staff) and surfaced via existing `PermissionsSchema` on `OrganizationStaffSchema`. Auto-regenerated by `pnpm generate:api`.

## Decisions log

| Decision | Reasoning |
|---|---|
| Plans inside Members→Tiers (not own top-level section) | Plans belong to tiers conceptually; staying inside the existing shell minimizes IA churn. |
| Subscriptions as a tab in `/admin/members` (not a route) | Same shell, same context, low friction for staff who already work in this area. |
| Compact drawer over tabbed drawer / full route | Common case is fast lookup + one action; tabs would add a layer of navigation. Promote to a route in Phase 2 if cramped. |
| Combobox over existing org members only (no email-invite path) | Backend signal never auto-creates members; "must be a member first" is the real constraint. Avoid surfacing an option that errors. |
| Status-driven date copy on member card | Communicates intent ("renews" vs "ends") more clearly than raw timestamps. |
| Silent 404 on OrgMembershipInline | Public page shouldn't render an empty / broken state for the common case (no sub). |
| Cards on mobile, table on desktop | Existing codebase pattern; data density requires it. |
| Optimistic updates on lifecycle actions | Feels instant; backend state machine is well-defined and easy to reconcile on settle. |

## Open follow-ups (after Phase 1)

These slot in when PR 403 lands; called out so the spec isn't ambiguous about Phase 1 scope:

- Member-initiated subscribe (`POST /me/organizations/{org_id}/subscribe`)
- Member-initiated cancel, change-plan, revive
- Stripe billing portal entry point
- Metrics dashboard at `/admin/members` (MRR, churn)
- Plan migration tooling
- Editing grace period + refund policy on org settings
- 3-day renewal reminders, dunning UI hints

---

End of design.
