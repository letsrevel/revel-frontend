# Subscriptions Phase 1 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 (OFFLINE / staff-managed) membership subscriptions UI: admin CRUD for plans, subscription lifecycle + payments operations, and read-only member-facing views.

**Architecture:** Single feature branch. Plans live inline in the existing Members → Tiers tab. A new "Subscriptions" tab in the same `/admin/members` shell handles operational work via a list + modal-based detail view. Member-facing surfaces are `/account/memberships` and an inline card on `/org/[slug]`. All admin actions gate on `manage_subscriptions` permission. Optimistic mutations + TanStack Query for cache management. Auto-generated SDK only — no hand-written API code.

**Tech Stack:** SvelteKit, Svelte 5 Runes, TypeScript strict, TanStack Query, shadcn-svelte (Dialog / Button / Input / Select / Badge / Card / Tabs / DropdownMenu / Tooltip), Tailwind, Paraglide i18n, Vitest, Playwright. Backend SDK regenerated from `revel-backend` PR #405.

**Spec:** `docs/superpowers/specs/2026-05-14-subscriptions-phase1-ui-design.md`

**Conventions established in this codebase (follow exactly):**
- Mutation errors are surfaced via `alert(\`Failed to ...: ${error.message}\`)`. There is no toast util. Don't introduce one.
- Modals are built with shadcn `Dialog` (no Sheet/Drawer primitive). The "drawer" in the spec is a wide Dialog (`max-w-3xl` desktop; full-width mobile).
- i18n strings: every user-visible string goes through `$lib/paraglide/messages.js` (compile with `pnpm paraglide:compile` — never `npx`).
- Mobile testing: `pnpm dev` listens on 0.0.0.0; verify mobile breakpoints in browser before opening PR.
- Quality gate before PR: `make fix && make check && make test`.
- Commits follow conventional commits and end with the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- File length limits: Svelte 750, TS/JS 500 (`make file-length` enforces).

---

## File Structure

### New files

```
src/lib/utils/subscriptions.ts                                   # pure helpers
src/lib/utils/subscriptions.test.ts                              # unit tests
src/lib/components/members/StatusBadge.svelte                    # shared status pill
src/lib/components/members/PlanFormModal.svelte                  # create/edit plan
src/lib/components/members/PlansList.svelte                      # grid inside a tier card
src/lib/components/members/SubscriptionsTab.svelte               # list + search + filter
src/lib/components/members/SubscriptionListItem.svelte           # one row/card (responsive)
src/lib/components/members/SubscriptionCreateModal.svelte
src/lib/components/members/MemberCombobox.svelte                 # local primitive for picking members
src/lib/components/members/SubscriptionDrawer.svelte             # wide Dialog with payments + actions
src/lib/components/members/PaymentsTable.svelte
src/lib/components/members/RecordPaymentModal.svelte
src/lib/components/members/CancelSubscriptionDialog.svelte
src/lib/components/members/RefundPaymentDialog.svelte
src/lib/components/account/MembershipCard.svelte
src/lib/components/account/OrgMembershipInline.svelte
src/routes/(auth)/account/memberships/+page.svelte
src/routes/(auth)/account/memberships/+page.ts
tests/e2e/subscriptions.spec.ts                                  # E2E coverage
```

### Modified files

```
src/lib/components/members/TiersTab.svelte                       # mount PlansList per tier card
src/routes/(auth)/org/[slug]/admin/members/+page.svelte          # add Subscriptions tab
src/routes/(public)/org/[slug]/+page.svelte                      # mount OrgMembershipInline
messages/en.json (and any other locales)                         # new i18n keys
```

---

## Reference patterns (read once before starting)

- **Existing tabbed admin page:** `src/routes/(auth)/org/[slug]/admin/members/+page.svelte`
- **Modal pattern (Dialog + form):** `src/lib/components/members/TierFormModal.svelte`
- **Mutation pattern (create/update/delete with invalidation):** `src/lib/components/members/TiersTab.svelte`
- **Query pattern (paginated list with search):** `src/lib/components/members/MembersTab.svelte`
- **Account sub-route pattern:** `src/routes/(auth)/account/invoices/`
- **Org public page composition:** `src/routes/(public)/org/[slug]/+page.svelte`

---

## Task 1: Subscription utilities + tests

**Files:**
- Create: `src/lib/utils/subscriptions.ts`
- Create: `src/lib/utils/subscriptions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/utils/subscriptions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	getAvailableActions,
	formatPlanPrice,
	getStatusConfig,
	getDateLine
} from './subscriptions';
import type { MySubscriptionSchema, PlanSchema } from '$lib/api/generated/types.gen';

const basePlan: PlanSchema = {
	id: 'p1',
	tier_id: 't1',
	name: 'Gold Monthly',
	description: '',
	price: '10.00',
	currency: 'EUR',
	period_unit: 'month',
	period_count: 1,
	is_active: true,
	payment_method: 'offline'
} as PlanSchema;

function makeSub(status: MySubscriptionSchema['status'], over: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 's1',
		plan_id: 'p1',
		organization_id: 'o1',
		status,
		current_period_start: null,
		current_period_end: '2026-06-14T00:00:00Z',
		cancel_at_period_end: false,
		cancelled_at: null,
		created_at: '2026-05-14T00:00:00Z',
		updated_at: '2026-05-14T00:00:00Z',
		plan: basePlan,
		organization_name: 'Sunset Yoga',
		organization_slug: 'sunset-yoga',
		organization_logo_url: null,
		...over
	} as MySubscriptionSchema;
}

describe('getAvailableActions', () => {
	it.each([
		['pending', { recordPayment: true, pause: false, resume: false, cancel: true }],
		['active', { recordPayment: true, pause: true, resume: false, cancel: true }],
		['past_due', { recordPayment: true, pause: false, resume: false, cancel: true }],
		['paused', { recordPayment: false, pause: false, resume: true, cancel: true }],
		['cancelled', { recordPayment: false, pause: false, resume: false, cancel: false }],
		['expired', { recordPayment: false, pause: false, resume: false, cancel: false }]
	])('returns the right action set for %s', (status, expected) => {
		expect(getAvailableActions(makeSub(status as never))).toEqual(expected);
	});
});

describe('formatPlanPrice', () => {
	it('formats monthly', () => {
		expect(formatPlanPrice(basePlan, 'en')).toBe('€10.00 / month');
	});
	it('formats annual', () => {
		expect(formatPlanPrice({ ...basePlan, period_unit: 'year', period_count: 1 }, 'en')).toBe('€10.00 / year');
	});
	it('formats N-month', () => {
		expect(formatPlanPrice({ ...basePlan, period_count: 3 }, 'en')).toBe('€10.00 / 3 months');
	});
	it('formats N-year', () => {
		expect(formatPlanPrice({ ...basePlan, period_unit: 'year', period_count: 2 }, 'en')).toBe('€10.00 / 2 years');
	});
});

describe('getStatusConfig', () => {
	it.each([
		['active', 'green'],
		['pending', 'blue'],
		['past_due', 'amber'],
		['paused', 'gray'],
		['cancelled', 'muted'],
		['expired', 'red']
	])('maps %s to %s tone', (status, tone) => {
		expect(getStatusConfig(status as never).tone).toBe(tone);
	});
});

describe('getDateLine', () => {
	it('active → "Next renewal: …"', () => {
		const line = getDateLine(makeSub('active'));
		expect(line.kind).toBe('renewal');
	});
	it('active + cancel_at_period_end → "Cancels on …"', () => {
		const line = getDateLine(makeSub('active', { cancel_at_period_end: true }));
		expect(line.kind).toBe('cancels');
	});
	it('past_due → "Period ends …"', () => {
		const line = getDateLine(makeSub('past_due'));
		expect(line.kind).toBe('period_ends');
	});
	it('paused → "Paused since …"', () => {
		const line = getDateLine(makeSub('paused'));
		expect(line.kind).toBe('paused_since');
	});
	it('cancelled → "Ended …"', () => {
		const line = getDateLine(makeSub('cancelled', { cancelled_at: '2026-05-01T00:00:00Z' }));
		expect(line.kind).toBe('ended');
	});
	it('expired → "Ended …"', () => {
		expect(getDateLine(makeSub('expired')).kind).toBe('ended');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/utils/subscriptions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/utils/subscriptions.ts`**

```ts
import type {
	MySubscriptionSchema,
	SubscriptionSchema,
	PlanSchema,
	MembershipSubscriptionSubscriptionStatus,
	MembershipSubscriptionPlanPeriodUnit
} from '$lib/api/generated/types.gen';

export type SubscriptionStatus = MySubscriptionSchema['status'];

export interface ActionSet {
	recordPayment: boolean;
	pause: boolean;
	resume: boolean;
	cancel: boolean;
}

const ACTION_MATRIX: Record<SubscriptionStatus, ActionSet> = {
	pending: { recordPayment: true, pause: false, resume: false, cancel: true },
	active: { recordPayment: true, pause: true, resume: false, cancel: true },
	past_due: { recordPayment: true, pause: false, resume: false, cancel: true },
	paused: { recordPayment: false, pause: false, resume: true, cancel: true },
	cancelled: { recordPayment: false, pause: false, resume: false, cancel: false },
	expired: { recordPayment: false, pause: false, resume: false, cancel: false }
};

export function getAvailableActions(sub: MySubscriptionSchema | SubscriptionSchema): ActionSet {
	return ACTION_MATRIX[sub.status];
}

const PERIOD_UNIT_LABELS: Record<MembershipSubscriptionPlanPeriodUnit, { singular: string; plural: string }> = {
	month: { singular: 'month', plural: 'months' },
	year: { singular: 'year', plural: 'years' }
};

export function formatPlanPrice(plan: Pick<PlanSchema, 'price' | 'currency' | 'period_unit' | 'period_count'>, locale = 'en'): string {
	const amount = new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: plan.currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(Number(plan.price));
	const label = PERIOD_UNIT_LABELS[plan.period_unit];
	const unit = plan.period_count === 1 ? label.singular : `${plan.period_count} ${label.plural}`;
	return `${amount} / ${unit}`;
}

export type StatusTone = 'green' | 'blue' | 'amber' | 'gray' | 'red' | 'muted';

export interface StatusConfig {
	tone: StatusTone;
	className: string;
}

const STATUS_CONFIG: Record<SubscriptionStatus, StatusConfig> = {
	active: { tone: 'green', className: 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100' },
	pending: { tone: 'blue', className: 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100' },
	past_due: { tone: 'amber', className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100' },
	paused: { tone: 'gray', className: 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100' },
	cancelled: { tone: 'muted', className: 'bg-muted text-muted-foreground' },
	expired: { tone: 'red', className: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100' }
};

export function getStatusConfig(status: SubscriptionStatus): StatusConfig {
	return STATUS_CONFIG[status];
}

export type DateLineKind = 'renewal' | 'cancels' | 'period_ends' | 'paused_since' | 'ended' | 'pending';

export interface DateLine {
	kind: DateLineKind;
	date: string | null;
}

export function getDateLine(sub: MySubscriptionSchema | SubscriptionSchema): DateLine {
	if (sub.status === 'pending') return { kind: 'pending', date: sub.current_period_end };
	if (sub.status === 'paused') return { kind: 'paused_since', date: sub.updated_at };
	if (sub.status === 'cancelled' || sub.status === 'expired') {
		return { kind: 'ended', date: sub.cancelled_at ?? sub.updated_at };
	}
	if (sub.status === 'past_due') return { kind: 'period_ends', date: sub.current_period_end };
	// active
	if (sub.cancel_at_period_end) return { kind: 'cancels', date: sub.current_period_end };
	return { kind: 'renewal', date: sub.current_period_end };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/utils/subscriptions.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/subscriptions.ts src/lib/utils/subscriptions.test.ts
git commit -m "feat(subscriptions): action matrix, price formatter, status config helpers"
```

---

## Task 2: i18n keys

**Files:**
- Modify: `messages/en.json` (add new keys; other locales follow project convention — copy English values as fallback)

- [ ] **Step 1: Add all required keys at once**

Open `messages/en.json` and add (preserving JSON order; place near related `orgAdmin.members.*` and `account.*` keys):

```json
{
  "subscriptions.status.active": "Active",
  "subscriptions.status.pending": "Pending",
  "subscriptions.status.past_due": "Past due",
  "subscriptions.status.paused": "Paused",
  "subscriptions.status.cancelled": "Cancelled",
  "subscriptions.status.expired": "Expired",
  "subscriptions.dateLine.renewal": "Next renewal: {date}",
  "subscriptions.dateLine.cancels": "Cancels on {date}",
  "subscriptions.dateLine.periodEnds": "Period ends {date}",
  "subscriptions.dateLine.pausedSince": "Paused since {date}",
  "subscriptions.dateLine.ended": "Ended {date}",
  "subscriptions.dateLine.pending": "Awaiting first payment",

  "orgAdmin.members.tabs.subscriptions": "Subscriptions",

  "orgAdmin.members.plans.title": "Plans",
  "orgAdmin.members.plans.empty": "No plans yet.",
  "orgAdmin.members.plans.add": "Add plan",
  "orgAdmin.members.plans.archived": "Archived",
  "orgAdmin.members.plans.edit": "Edit",
  "orgAdmin.members.plans.archive": "Archive",
  "orgAdmin.members.plans.delete": "Delete",
  "orgAdmin.members.plans.form.create": "Create plan",
  "orgAdmin.members.plans.form.update": "Edit plan",
  "orgAdmin.members.plans.form.name": "Name",
  "orgAdmin.members.plans.form.description": "Description",
  "orgAdmin.members.plans.form.price": "Price",
  "orgAdmin.members.plans.form.currency": "Currency",
  "orgAdmin.members.plans.form.periodUnit": "Period",
  "orgAdmin.members.plans.form.periodCount": "Every",
  "orgAdmin.members.plans.form.isActive": "Active (available for new subscriptions)",
  "orgAdmin.members.plans.form.errors.nameRequired": "Name is required",
  "orgAdmin.members.plans.form.errors.priceInvalid": "Price must be 0 or more",
  "orgAdmin.members.plans.form.errors.periodInvalid": "Period count must be between 1 and 120",
  "orgAdmin.members.plans.delete.title": "Delete plan",
  "orgAdmin.members.plans.delete.body": "This permanently deletes the plan. If subscribers exist, archive it instead.",
  "orgAdmin.members.plans.delete.inUse": "This plan has subscribers and can't be deleted — archive it instead.",
  "orgAdmin.members.plans.delete.archiveInstead": "Archive instead",

  "orgAdmin.members.subscriptions.title": "Subscriptions",
  "orgAdmin.members.subscriptions.searchPlaceholder": "Search by name or email…",
  "orgAdmin.members.subscriptions.filter.all": "All statuses",
  "orgAdmin.members.subscriptions.create": "Create subscription",
  "orgAdmin.members.subscriptions.empty": "No subscriptions yet.",
  "orgAdmin.members.subscriptions.col.user": "User",
  "orgAdmin.members.subscriptions.col.plan": "Plan",
  "orgAdmin.members.subscriptions.col.status": "Status",
  "orgAdmin.members.subscriptions.col.periodEnd": "Period end",

  "orgAdmin.members.subscriptions.create.title": "Create subscription",
  "orgAdmin.members.subscriptions.create.user": "User",
  "orgAdmin.members.subscriptions.create.plan": "Plan",
  "orgAdmin.members.subscriptions.create.recordInitial": "Record initial payment",
  "orgAdmin.members.subscriptions.create.amount": "Amount",
  "orgAdmin.members.subscriptions.create.currency": "Currency",
  "orgAdmin.members.subscriptions.create.notes": "Notes",
  "orgAdmin.members.subscriptions.create.submit": "Create",
  "orgAdmin.members.subscriptions.create.errors.userRequired": "Pick a member",
  "orgAdmin.members.subscriptions.create.errors.planRequired": "Pick a plan",

  "orgAdmin.members.subscriptions.drawer.recordPayment": "Record payment",
  "orgAdmin.members.subscriptions.drawer.pause": "Pause",
  "orgAdmin.members.subscriptions.drawer.resume": "Resume",
  "orgAdmin.members.subscriptions.drawer.cancel": "Cancel",
  "orgAdmin.members.subscriptions.drawer.payments": "Payments",
  "orgAdmin.members.subscriptions.drawer.paymentsEmpty": "No payments yet.",
  "orgAdmin.members.subscriptions.drawer.refund": "Refund",

  "orgAdmin.members.subscriptions.cancel.title": "Cancel subscription",
  "orgAdmin.members.subscriptions.cancel.atPeriodEnd": "At the end of the current period ({date})",
  "orgAdmin.members.subscriptions.cancel.atPeriodEndDesc": "The member keeps access until then.",
  "orgAdmin.members.subscriptions.cancel.immediate": "Immediately",
  "orgAdmin.members.subscriptions.cancel.immediateDesc": "Access is revoked now. No refund is issued automatically.",
  "orgAdmin.members.subscriptions.cancel.immediateConfirm": "I understand access is revoked immediately.",
  "orgAdmin.members.subscriptions.cancel.keep": "Keep subscription",
  "orgAdmin.members.subscriptions.cancel.confirm": "Confirm cancellation",

  "orgAdmin.members.subscriptions.recordPayment.title": "Record payment",
  "orgAdmin.members.subscriptions.recordPayment.amount": "Amount",
  "orgAdmin.members.subscriptions.recordPayment.currency": "Currency",
  "orgAdmin.members.subscriptions.recordPayment.status": "Status",
  "orgAdmin.members.subscriptions.recordPayment.notes": "Notes",
  "orgAdmin.members.subscriptions.recordPayment.currencyWarning": "This subscription is billed in {planCurrency} — recording in {selected} is unusual.",
  "orgAdmin.members.subscriptions.recordPayment.submit": "Record payment",

  "orgAdmin.members.subscriptions.refund.title": "Mark payment as refunded",
  "orgAdmin.members.subscriptions.refund.body": "This records the refund for bookkeeping. Issue the actual refund out-of-band (cash, bank transfer, or Stripe dashboard).",
  "orgAdmin.members.subscriptions.refund.notes": "Notes",
  "orgAdmin.members.subscriptions.refund.submit": "Mark refunded",

  "account.memberships.title": "My Memberships",
  "account.memberships.empty.title": "You don't have any active memberships.",
  "account.memberships.empty.body": "Memberships are managed by the organizations you belong to.",
  "account.memberships.empty.cta": "Discover organizations",
  "account.memberships.viewOrg": "View org",
  "account.memberships.contactOrg": "Reach out to the organizer to renew.",

  "orgPublic.yourMembership.title": "Your membership",
  "orgPublic.yourMembership.managedBy": "Managed by {org} staff"
}
```

- [ ] **Step 2: Compile and verify**

Run: `pnpm paraglide:compile && pnpm check`
Expected: no missing-key errors. The `m['key.path']()` lookups for all keys above will be available.

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "i18n(subscriptions): add Phase 1 admin + member-facing message keys"
```

---

## Task 3: StatusBadge component

**Files:**
- Create: `src/lib/components/members/StatusBadge.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getStatusConfig, type SubscriptionStatus } from '$lib/utils/subscriptions';

	interface Props {
		status: SubscriptionStatus;
		class?: string;
	}

	let { status, class: extraClass = '' }: Props = $props();

	const config = $derived(getStatusConfig(status));
	const label = $derived(
		({
			active: m['subscriptions.status.active'](),
			pending: m['subscriptions.status.pending'](),
			past_due: m['subscriptions.status.past_due'](),
			paused: m['subscriptions.status.paused'](),
			cancelled: m['subscriptions.status.cancelled'](),
			expired: m['subscriptions.status.expired']()
		})[status]
	);
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {config.className} {extraClass}"
	aria-label={label}
>
	{label}
</span>
```

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: 0 errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/members/StatusBadge.svelte
git commit -m "feat(subscriptions): add StatusBadge component"
```

---

## Task 4: PlanFormModal component

**Files:**
- Create: `src/lib/components/members/PlanFormModal.svelte`

- [ ] **Step 1: Build form modal**

Use `src/lib/components/members/TierFormModal.svelte` as the structural reference (open/onClose/onSave/isSaving prop pattern, Dialog wrapper, `$effect` to sync prop → state, errors object, validate()).

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		PlanSchema,
		PlanCreateSchema,
		Currencies,
		MembershipSubscriptionPlanPeriodUnit
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';
	import { Loader2 } from 'lucide-svelte';
	import { CURRENCY_OPTIONS } from '$lib/utils/currencies';

	export type PlanFormPayload = PlanCreateSchema;

	interface Props {
		plan: PlanSchema | null;
		open: boolean;
		onClose: () => void;
		onSave: (payload: PlanFormPayload) => void;
		isSaving?: boolean;
	}

	const { plan, open, onClose, onSave, isSaving = false }: Props = $props();

	let name = $state('');
	let description = $state('');
	let price = $state('0.00');
	let currency = $state<Currencies>('EUR');
	let periodUnit = $state<MembershipSubscriptionPlanPeriodUnit>('month');
	let periodCount = $state(1);
	let isActive = $state(true);
	let errors = $state<{ name?: string; price?: string; period?: string }>({});

	$effect(() => {
		if (plan) {
			name = plan.name;
			description = plan.description ?? '';
			price = String(plan.price);
			currency = plan.currency as Currencies;
			periodUnit = plan.period_unit;
			periodCount = plan.period_count;
			isActive = plan.is_active;
		} else {
			name = '';
			description = '';
			price = '0.00';
			currency = 'EUR';
			periodUnit = 'month';
			periodCount = 1;
			isActive = true;
		}
		errors = {};
	});

	function validate(): boolean {
		errors = {};
		if (!name.trim()) {
			errors.name = m['orgAdmin.members.plans.form.errors.nameRequired']();
			return false;
		}
		const numeric = Number(price);
		if (!Number.isFinite(numeric) || numeric < 0) {
			errors.price = m['orgAdmin.members.plans.form.errors.priceInvalid']();
			return false;
		}
		if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 120) {
			errors.period = m['orgAdmin.members.plans.form.errors.periodInvalid']();
			return false;
		}
		return true;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;
		onSave({
			name: name.trim(),
			description,
			price,
			currency,
			period_unit: periodUnit,
			period_count: periodCount,
			is_active: isActive
		});
	}
</script>

<Dialog {open} onOpenChange={(v) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>
				{plan
					? m['orgAdmin.members.plans.form.update']()
					: m['orgAdmin.members.plans.form.create']()}
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-1">
				<Label for="plan-name">{m['orgAdmin.members.plans.form.name']()}</Label>
				<Input id="plan-name" bind:value={name} maxlength={255} required />
				{#if errors.name}<p class="text-sm text-red-600">{errors.name}</p>{/if}
			</div>

			<div class="space-y-1">
				<Label for="plan-desc">{m['orgAdmin.members.plans.form.description']()}</Label>
				<Textarea id="plan-desc" bind:value={description} rows={2} />
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="plan-price">{m['orgAdmin.members.plans.form.price']()}</Label>
					<Input id="plan-price" type="number" min="0" step="0.01" bind:value={price} required />
				</div>
				<div class="space-y-1">
					<Label for="plan-currency">{m['orgAdmin.members.plans.form.currency']()}</Label>
					<Select type="single" bind:value={currency as string}>
						<SelectTrigger id="plan-currency"><SelectValue /></SelectTrigger>
						<SelectContent>
							{#each CURRENCY_OPTIONS as opt}
								<SelectItem value={opt.value}>{opt.label}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
			</div>
			{#if errors.price}<p class="text-sm text-red-600">{errors.price}</p>{/if}

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="plan-period-count">{m['orgAdmin.members.plans.form.periodCount']()}</Label>
					<Input
						id="plan-period-count"
						type="number"
						min="1"
						max="120"
						bind:value={periodCount}
						required
					/>
				</div>
				<div class="space-y-1">
					<Label for="plan-period-unit">{m['orgAdmin.members.plans.form.periodUnit']()}</Label>
					<Select type="single" bind:value={periodUnit as string}>
						<SelectTrigger id="plan-period-unit"><SelectValue /></SelectTrigger>
						<SelectContent>
							<SelectItem value="month">month(s)</SelectItem>
							<SelectItem value="year">year(s)</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
			{#if errors.period}<p class="text-sm text-red-600">{errors.period}</p>{/if}

			<div class="flex items-center gap-2">
				<Checkbox id="plan-active" bind:checked={isActive} />
				<Label for="plan-active">{m['orgAdmin.members.plans.form.isActive']()}</Label>
			</div>

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSaving}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSaving}>
					{#if isSaving}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{plan
						? m['orgAdmin.members.plans.form.update']()
						: m['orgAdmin.members.plans.form.create']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
```

> **Note:** This task imports `CURRENCY_OPTIONS` from `$lib/utils/currencies`. If that doesn't exist, look at the existing currency picker referenced in the 1.50.2 fix; it lives in the ticket tier form. If the shape differs, adapt the import path. **Verify** with `grep -rn "CURRENCY_OPTIONS\|Currencies\[\]" src/lib`.

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/members/PlanFormModal.svelte
git commit -m "feat(subscriptions): add PlanFormModal component"
```

---

## Task 5: PlansList component (per-tier inline)

**Files:**
- Create: `src/lib/components/members/PlansList.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsListSubscriptionPlans,
		organizationadminsubscriptionsCreateSubscriptionPlan,
		organizationadminsubscriptionsUpdateSubscriptionPlan,
		organizationadminsubscriptionsDeleteSubscriptionPlan,
		organizationadminsubscriptionsArchiveSubscriptionPlan
	} from '$lib/api/generated/sdk.gen';
	import type {
		PlanSchema,
		MembershipTierSchema,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Pencil, Archive, Trash2, Plus, Loader2 } from 'lucide-svelte';
	import PlanFormModal, { type PlanFormPayload } from './PlanFormModal.svelte';
	import { formatPlanPrice } from '$lib/utils/subscriptions';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		tier: MembershipTierSchema;
	}

	const { organization, tier }: Props = $props();
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	const plansQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'tier', tier.id, 'plans'],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListSubscriptionPlans({
				path: { slug: organization.slug, tier_id: tier.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load plans');
			return res.data as PlanSchema[];
		},
		enabled: !!accessToken
	}));

	const plans = $derived(plansQuery.data ?? []);

	let editing = $state<PlanSchema | null>(null);
	let formOpen = $state(false);

	const createMut = createMutation(() => ({
		mutationFn: async (payload: PlanFormPayload) => {
			const res = await organizationadminsubscriptionsCreateSubscriptionPlan({
				path: { slug: organization.slug, tier_id: tier.id },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to create plan');
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tier', tier.id, 'plans']
			});
			formOpen = false;
		},
		onError: (err: Error) => alert(`Failed to create plan: ${err.message}`)
	}));

	const updateMut = createMutation(() => ({
		mutationFn: async ({ id, payload }: { id: string; payload: PlanFormPayload }) => {
			const res = await organizationadminsubscriptionsUpdateSubscriptionPlan({
				path: { slug: organization.slug, plan_id: id },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to update plan');
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tier', tier.id, 'plans']
			});
			formOpen = false;
			editing = null;
		},
		onError: (err: Error) => alert(`Failed to update plan: ${err.message}`)
	}));

	const archiveMut = createMutation(() => ({
		mutationFn: async (id: string) => {
			const res = await organizationadminsubscriptionsArchiveSubscriptionPlan({
				path: { slug: organization.slug, plan_id: id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to archive plan');
			return res.data;
		},
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tier', tier.id, 'plans']
			}),
		onError: (err: Error) => alert(`Failed to archive plan: ${err.message}`)
	}));

	const deleteMut = createMutation(() => ({
		mutationFn: async (id: string) => {
			const res = await organizationadminsubscriptionsDeleteSubscriptionPlan({
				path: { slug: organization.slug, plan_id: id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) {
				// Backend rejects when subscriptions reference the plan.
				throw new Error(m['orgAdmin.members.plans.delete.inUse']());
			}
		},
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tier', tier.id, 'plans']
			}),
		onError: (err: Error) => {
			if (confirm(`${err.message}\n\n${m['orgAdmin.members.plans.delete.archiveInstead']()}?`)) {
				// caller passed id via closure on row click — see handler below
			}
		}
	}));

	function openCreate() {
		editing = null;
		formOpen = true;
	}
	function openEdit(p: PlanSchema) {
		editing = p;
		formOpen = true;
	}
	function handleSave(payload: PlanFormPayload) {
		if (editing) updateMut.mutate({ id: editing.id, payload });
		else createMut.mutate(payload);
	}
	function handleDelete(p: PlanSchema) {
		if (!confirm(`Delete ${p.name}?`)) return;
		deleteMut.mutate(p.id, {
			onError: () => {
				if (confirm(m['orgAdmin.members.plans.delete.archiveInstead']() + '?')) {
					archiveMut.mutate(p.id);
				}
			}
		});
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<h4 class="text-sm font-semibold">{m['orgAdmin.members.plans.title']()}</h4>
		<Button size="sm" variant="outline" onclick={openCreate}>
			<Plus class="mr-1 h-3 w-3" />
			{m['orgAdmin.members.plans.add']()}
		</Button>
	</div>

	{#if plansQuery.isLoading}
		<Loader2 class="h-4 w-4 animate-spin" />
	{:else if plans.length === 0}
		<p class="text-sm text-muted-foreground">{m['orgAdmin.members.plans.empty']()}</p>
	{:else}
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
			{#each plans as p (p.id)}
				<Card class={p.is_active ? '' : 'opacity-60'}>
					<CardContent class="p-3">
						<div class="flex items-start justify-between gap-2">
							<div>
								<p class="font-medium">{p.name}</p>
								<p class="text-sm text-muted-foreground">{formatPlanPrice(p)}</p>
								{#if !p.is_active}
									<p class="mt-1 text-xs text-muted-foreground">
										{m['orgAdmin.members.plans.archived']()}
									</p>
								{/if}
							</div>
							<div class="flex gap-1">
								<Button size="icon" variant="ghost" aria-label={m['orgAdmin.members.plans.edit']()} onclick={() => openEdit(p)}>
									<Pencil class="h-4 w-4" />
								</Button>
								{#if p.is_active}
									<Button
										size="icon"
										variant="ghost"
										aria-label={m['orgAdmin.members.plans.archive']()}
										onclick={() => archiveMut.mutate(p.id)}
									>
										<Archive class="h-4 w-4" />
									</Button>
								{/if}
								<Button
									size="icon"
									variant="ghost"
									aria-label={m['orgAdmin.members.plans.delete']()}
									onclick={() => handleDelete(p)}
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<PlanFormModal
	plan={editing}
	open={formOpen}
	onClose={() => {
		formOpen = false;
		editing = null;
	}}
	onSave={handleSave}
	isSaving={createMut.isPending || updateMut.isPending}
/>
```

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/members/PlansList.svelte
git commit -m "feat(subscriptions): add PlansList component for per-tier plan CRUD"
```

---

## Task 6: Mount PlansList in TiersTab

**Files:**
- Modify: `src/lib/components/members/TiersTab.svelte`

- [ ] **Step 1: Read the file**

Use `Read` on `src/lib/components/members/TiersTab.svelte` to find the tier-card render block.

- [ ] **Step 2: Insert PlansList**

At the top of the script block, add:

```svelte
import PlansList from './PlansList.svelte';
```

In the template, inside each tier card render (after the tier description, before the "Edit / Delete" action buttons), insert:

```svelte
<div class="mt-3 border-t pt-3">
	<PlansList {organization} tier={t} />
</div>
```

(where `t` is the iteration variable in `{#each tiers as t}` — check the actual variable name in the file and match it.)

- [ ] **Step 3: Type-check + visual**

Run: `pnpm check`
Expected: 0 errors.

Run dev server: `pnpm dev`. Visit `/admin/members` → Tiers tab. Each tier card now shows its plans inline.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/members/TiersTab.svelte
git commit -m "feat(subscriptions): mount PlansList inside each tier card"
```

---

## Task 7: MemberCombobox component

**Files:**
- Create: `src/lib/components/members/MemberCombobox.svelte`

- [ ] **Step 1: Implement a minimal type-ahead combobox**

```svelte
<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminmembersListMembers } from '$lib/api/generated/sdk.gen';
	import type { OrganizationMemberSchema, OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Input } from '$lib/components/ui/input';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		value: OrganizationMemberSchema | null;
		onSelect: (member: OrganizationMemberSchema | null) => void;
		placeholder?: string;
	}

	const { organization, value, onSelect, placeholder = '' }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	let query = $state('');
	let debounced = $state('');
	let open = $state(false);
	let inputEl: HTMLInputElement;

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		clearTimeout(debounceTimer);
		const q = query;
		debounceTimer = setTimeout(() => {
			debounced = q;
		}, 250);
		return () => clearTimeout(debounceTimer);
	});

	const membersQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'members', 'combobox', debounced],
		queryFn: async () => {
			const res = await organizationadminmembersListMembers({
				path: { slug: organization.slug },
				query: { page_size: 20, search: debounced || undefined },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to search members');
			return res.data;
		},
		enabled: !!accessToken && open
	}));

	const results = $derived(membersQuery.data?.items ?? []);

	function pick(member: OrganizationMemberSchema) {
		onSelect(member);
		query = member.user.email;
		open = false;
	}
</script>

<div class="relative">
	<Input
		bind:ref={inputEl}
		bind:value={query}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 150)}
		{placeholder}
		aria-autocomplete="list"
		aria-expanded={open}
	/>
	{#if open && results.length > 0}
		<ul
			role="listbox"
			class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-lg"
		>
			{#each results as r (r.id)}
				<li role="option" aria-selected={value?.id === r.id}>
					<button
						type="button"
						class="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
						onmousedown={(e) => {
							e.preventDefault();
							pick(r);
						}}
					>
						<div class="font-medium">
							{r.user.first_name || r.user.preferred_name || r.user.email}
							{#if r.user.last_name}{r.user.last_name}{/if}
						</div>
						<div class="text-xs text-muted-foreground">{r.user.email}</div>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
```

> **Verify field shape:** `OrganizationMemberSchema` may differ in how it nests user info. Read `src/lib/api/generated/types.gen.ts` for the exact property names and adjust the `r.user.*` accesses.

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: 0 errors (correct nested fields).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/members/MemberCombobox.svelte
git commit -m "feat(subscriptions): add MemberCombobox for picking users"
```

---

## Task 8: SubscriptionCreateModal

**Files:**
- Create: `src/lib/components/members/SubscriptionCreateModal.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminmembersListMembershipTiers } from '$lib/api/generated/sdk.gen';
	// list_plans endpoint per-tier; we'll fetch all tiers and concat plans
	import { organizationadminsubscriptionsListSubscriptionPlans } from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationAdminDetailSchema,
		PlanSchema,
		MembershipTierSchema,
		OrganizationMemberSchema,
		SubscriptionCreateSchema,
		Currencies
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';
	import { Loader2 } from 'lucide-svelte';
	import MemberCombobox from './MemberCombobox.svelte';
	import { CURRENCY_OPTIONS } from '$lib/utils/currencies';
	import { formatPlanPrice } from '$lib/utils/subscriptions';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		open: boolean;
		onClose: () => void;
		onSubmit: (payload: SubscriptionCreateSchema) => void;
		isSubmitting?: boolean;
	}

	const { organization, open, onClose, onSubmit, isSubmitting = false }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	let selectedMember = $state<OrganizationMemberSchema | null>(null);
	let planId = $state<string>('');
	let recordInitial = $state(false);
	let amount = $state('0.00');
	let currency = $state<Currencies>('EUR');
	let notes = $state('');
	let errors = $state<{ user?: string; plan?: string }>({});

	const tiersQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'membership-tiers'],
		queryFn: async () => {
			const res = await organizationadminmembersListMembershipTiers({
				path: { slug: organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load tiers');
			return res.data as MembershipTierSchema[];
		},
		enabled: open && !!accessToken
	}));

	// Aggregate active plans across all tiers
	let allPlans = $state<PlanSchema[]>([]);
	$effect(() => {
		if (!open || !tiersQuery.data) return;
		(async () => {
			const all: PlanSchema[] = [];
			for (const t of tiersQuery.data!) {
				const r = await organizationadminsubscriptionsListSubscriptionPlans({
					path: { slug: organization.slug, tier_id: t.id },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (!r.error && r.data) all.push(...(r.data as PlanSchema[]).filter((p) => p.is_active));
			}
			allPlans = all;
		})();
	});

	$effect(() => {
		const p = allPlans.find((pl) => pl.id === planId);
		if (p) currency = p.currency as Currencies;
	});

	$effect(() => {
		if (!open) {
			selectedMember = null;
			planId = '';
			recordInitial = false;
			amount = '0.00';
			currency = 'EUR';
			notes = '';
			errors = {};
		}
	});

	function validate(): boolean {
		errors = {};
		if (!selectedMember) {
			errors.user = m['orgAdmin.members.subscriptions.create.errors.userRequired']();
			return false;
		}
		if (!planId) {
			errors.plan = m['orgAdmin.members.subscriptions.create.errors.planRequired']();
			return false;
		}
		return true;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;
		const payload: SubscriptionCreateSchema = {
			user_id: selectedMember!.user.id,
			plan_id: planId
		};
		if (recordInitial) {
			payload.initial_payment_amount = amount;
			payload.initial_payment_currency = currency;
			payload.initial_payment_notes = notes;
		}
		onSubmit(payload);
	}
</script>

<Dialog {open} onOpenChange={(v) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.create.title']()}</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-1">
				<Label>{m['orgAdmin.members.subscriptions.create.user']()}</Label>
				<MemberCombobox
					{organization}
					value={selectedMember}
					onSelect={(member) => (selectedMember = member)}
				/>
				{#if errors.user}<p class="text-sm text-red-600">{errors.user}</p>{/if}
			</div>

			<div class="space-y-1">
				<Label for="sub-plan">{m['orgAdmin.members.subscriptions.create.plan']()}</Label>
				<Select type="single" bind:value={planId}>
					<SelectTrigger id="sub-plan"><SelectValue /></SelectTrigger>
					<SelectContent>
						{#each allPlans as p}
							<SelectItem value={p.id}>{p.name} — {formatPlanPrice(p)}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
				{#if errors.plan}<p class="text-sm text-red-600">{errors.plan}</p>{/if}
			</div>

			<div class="flex items-center gap-2">
				<Checkbox id="sub-initial" bind:checked={recordInitial} />
				<Label for="sub-initial">{m['orgAdmin.members.subscriptions.create.recordInitial']()}</Label>
			</div>

			{#if recordInitial}
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="sub-amt">{m['orgAdmin.members.subscriptions.create.amount']()}</Label>
						<Input id="sub-amt" type="number" min="0" step="0.01" bind:value={amount} />
					</div>
					<div class="space-y-1">
						<Label for="sub-cur">{m['orgAdmin.members.subscriptions.create.currency']()}</Label>
						<Select type="single" bind:value={currency as string}>
							<SelectTrigger id="sub-cur"><SelectValue /></SelectTrigger>
							<SelectContent>
								{#each CURRENCY_OPTIONS as opt}<SelectItem value={opt.value}>{opt.label}</SelectItem>{/each}
							</SelectContent>
						</Select>
					</div>
				</div>
				<div class="space-y-1">
					<Label for="sub-notes">{m['orgAdmin.members.subscriptions.create.notes']()}</Label>
					<Textarea id="sub-notes" bind:value={notes} rows={2} />
				</div>
			{/if}

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>Cancel</Button>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.subscriptions.create.submit']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
```

- [ ] **Step 2: Type-check + commit**

Run: `pnpm check`
Expected: 0 errors.

```bash
git add src/lib/components/members/SubscriptionCreateModal.svelte
git commit -m "feat(subscriptions): add SubscriptionCreateModal with member combobox"
```

---

## Task 9: SubscriptionListItem (row/card responsive)

**Files:**
- Create: `src/lib/components/members/SubscriptionListItem.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SubscriptionSchema } from '$lib/api/generated/types.gen';
	import StatusBadge from './StatusBadge.svelte';
	import { formatPlanPrice } from '$lib/utils/subscriptions';

	interface Props {
		sub: SubscriptionSchema;
		onClick: () => void;
	}

	const { sub, onClick }: Props = $props();

	function fmtDate(d: string | null): string {
		if (!d) return '—';
		return new Date(d).toLocaleDateString();
	}
</script>

<!-- Desktop row -->
<tr class="hidden cursor-pointer hover:bg-accent md:table-row" onclick={onClick}>
	<td class="px-3 py-2">
		<div class="font-medium">{sub.user_display_name}</div>
		<div class="text-xs text-muted-foreground">{sub.user_email}</div>
	</td>
	<td class="px-3 py-2">
		<div>{sub.plan.name}</div>
		<div class="text-xs text-muted-foreground">{formatPlanPrice(sub.plan)}</div>
	</td>
	<td class="px-3 py-2"><StatusBadge status={sub.status} /></td>
	<td class="px-3 py-2 text-sm">{fmtDate(sub.current_period_end)}</td>
</tr>

<!-- Mobile card -->
<button
	type="button"
	class="block w-full rounded-lg border p-3 text-left hover:bg-accent md:hidden"
	onclick={onClick}
>
	<div class="flex items-start justify-between gap-2">
		<div>
			<div class="font-medium">{sub.user_display_name}</div>
			<div class="text-xs text-muted-foreground">{sub.user_email}</div>
		</div>
		<StatusBadge status={sub.status} />
	</div>
	<div class="mt-2 text-sm">
		{sub.plan.name} · {formatPlanPrice(sub.plan)}
	</div>
	<div class="mt-1 text-xs text-muted-foreground">
		{m['orgAdmin.members.subscriptions.col.periodEnd']()}: {fmtDate(sub.current_period_end)}
	</div>
</button>
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm check
git add src/lib/components/members/SubscriptionListItem.svelte
git commit -m "feat(subscriptions): add responsive SubscriptionListItem"
```

---

## Task 10: SubscriptionsTab (list + search + filter + create)

**Files:**
- Create: `src/lib/components/members/SubscriptionsTab.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsListSubscriptions,
		organizationadminsubscriptionsCreateSubscription
	} from '$lib/api/generated/sdk.gen';
	import type {
		SubscriptionSchema,
		OrganizationAdminDetailSchema,
		SubscriptionCreateSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';
	import { Loader2, Plus } from 'lucide-svelte';
	import SubscriptionListItem from './SubscriptionListItem.svelte';
	import SubscriptionCreateModal from './SubscriptionCreateModal.svelte';
	import SubscriptionDrawer from './SubscriptionDrawer.svelte';

	interface Props {
		organization: OrganizationAdminDetailSchema;
	}

	const { organization }: Props = $props();
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let search = $state('');
	let debounced = $state('');
	let statusFilter = $state<string>('all');
	let page = $state(1);
	let createOpen = $state(false);
	let drawerSubId = $state<string | null>(null);

	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		clearTimeout(timer);
		const q = search;
		timer = setTimeout(() => {
			debounced = q;
			page = 1;
		}, 300);
		return () => clearTimeout(timer);
	});

	const subsQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'subscriptions', { search: debounced, page }],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListSubscriptions({
				path: { slug: organization.slug },
				query: { page, page_size: 20, search: debounced || undefined },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load subscriptions');
			return res.data;
		},
		enabled: !!accessToken
	}));

	const items = $derived((subsQuery.data?.items ?? []) as SubscriptionSchema[]);
	const filtered = $derived(
		statusFilter === 'all' ? items : items.filter((s) => s.status === statusFilter)
	);

	const createMut = createMutation(() => ({
		mutationFn: async (payload: SubscriptionCreateSchema) => {
			const res = await organizationadminsubscriptionsCreateSubscription({
				path: { slug: organization.slug },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) {
				const detail = (res.error as { detail?: string }).detail ?? 'Failed to create subscription';
				throw new Error(detail);
			}
			return res.data as SubscriptionSchema;
		},
		onSuccess: (sub) => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'subscriptions']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
			createOpen = false;
			drawerSubId = sub.id;
		},
		onError: (err: Error) => alert(`Failed to create subscription: ${err.message}`)
	}));
</script>

<div class="space-y-3">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex flex-1 flex-col gap-2 sm:flex-row">
			<Input
				bind:value={search}
				placeholder={m['orgAdmin.members.subscriptions.searchPlaceholder']()}
				class="max-w-sm"
			/>
			<Select type="single" bind:value={statusFilter}>
				<SelectTrigger class="w-full sm:w-48"><SelectValue /></SelectTrigger>
				<SelectContent>
					<SelectItem value="all">{m['orgAdmin.members.subscriptions.filter.all']()}</SelectItem>
					<SelectItem value="active">{m['subscriptions.status.active']()}</SelectItem>
					<SelectItem value="pending">{m['subscriptions.status.pending']()}</SelectItem>
					<SelectItem value="past_due">{m['subscriptions.status.past_due']()}</SelectItem>
					<SelectItem value="paused">{m['subscriptions.status.paused']()}</SelectItem>
					<SelectItem value="cancelled">{m['subscriptions.status.cancelled']()}</SelectItem>
					<SelectItem value="expired">{m['subscriptions.status.expired']()}</SelectItem>
				</SelectContent>
			</Select>
		</div>
		<Button onclick={() => (createOpen = true)}>
			<Plus class="mr-1 h-4 w-4" />
			{m['orgAdmin.members.subscriptions.create']()}
		</Button>
	</div>

	{#if subsQuery.isLoading}
		<Loader2 class="h-5 w-5 animate-spin" />
	{:else if filtered.length === 0}
		<p class="text-sm text-muted-foreground">{m['orgAdmin.members.subscriptions.empty']()}</p>
	{:else}
		<!-- Desktop table -->
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full text-sm">
				<thead class="border-b">
					<tr>
						<th class="px-3 py-2 text-left">{m['orgAdmin.members.subscriptions.col.user']()}</th>
						<th class="px-3 py-2 text-left">{m['orgAdmin.members.subscriptions.col.plan']()}</th>
						<th class="px-3 py-2 text-left">{m['orgAdmin.members.subscriptions.col.status']()}</th>
						<th class="px-3 py-2 text-left">{m['orgAdmin.members.subscriptions.col.periodEnd']()}</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as s (s.id)}
						<SubscriptionListItem sub={s} onClick={() => (drawerSubId = s.id)} />
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile cards (the same component renders a button for mobile) -->
		<div class="grid gap-2 md:hidden">
			{#each filtered as s (s.id)}
				<SubscriptionListItem sub={s} onClick={() => (drawerSubId = s.id)} />
			{/each}
		</div>
	{/if}
</div>

<SubscriptionCreateModal
	{organization}
	open={createOpen}
	onClose={() => (createOpen = false)}
	onSubmit={(p) => createMut.mutate(p)}
	isSubmitting={createMut.isPending}
/>

{#if drawerSubId}
	<SubscriptionDrawer
		{organization}
		subId={drawerSubId}
		open={!!drawerSubId}
		onClose={() => (drawerSubId = null)}
	/>
{/if}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm check
git add src/lib/components/members/SubscriptionsTab.svelte
git commit -m "feat(subscriptions): add SubscriptionsTab (list, search, filter, create)"
```

---

## Task 11: PaymentsTable component

**Files:**
- Create: `src/lib/components/members/PaymentsTable.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipPaymentSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		payments: MembershipPaymentSchema[];
		onRefund: (p: MembershipPaymentSchema) => void;
	}

	const { payments, onRefund }: Props = $props();

	function fmtDate(d: string): string {
		return new Date(d).toLocaleDateString();
	}
</script>

{#if payments.length === 0}
	<p class="text-sm text-muted-foreground">
		{m['orgAdmin.members.subscriptions.drawer.paymentsEmpty']()}
	</p>
{:else}
	<table class="w-full text-sm">
		<thead class="border-b text-left">
			<tr>
				<th class="py-2">Date</th>
				<th class="py-2">Amount</th>
				<th class="py-2">Status</th>
				<th class="py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each payments as p (p.id)}
				<tr class="border-b last:border-0">
					<td class="py-2">{fmtDate(p.created_at)}</td>
					<td class="py-2">{p.amount} {p.currency}</td>
					<td class="py-2 capitalize">{p.status}</td>
					<td class="py-2 text-right">
						{#if p.status === 'succeeded'}
							<Button size="sm" variant="ghost" onclick={() => onRefund(p)}>
								{m['orgAdmin.members.subscriptions.drawer.refund']()}
							</Button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
```

- [ ] **Step 2: Commit**

```bash
pnpm check
git add src/lib/components/members/PaymentsTable.svelte
git commit -m "feat(subscriptions): add PaymentsTable component"
```

---

## Task 12: RecordPaymentModal

**Files:**
- Create: `src/lib/components/members/RecordPaymentModal.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		SubscriptionSchema,
		PaymentRecordSchema,
		Currencies,
		MembershipPaymentPaymentStatus
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';
	import { Loader2 } from 'lucide-svelte';
	import { CURRENCY_OPTIONS } from '$lib/utils/currencies';

	interface Props {
		subscription: SubscriptionSchema;
		open: boolean;
		onClose: () => void;
		onSubmit: (payload: PaymentRecordSchema) => void;
		isSubmitting?: boolean;
	}

	const { subscription, open, onClose, onSubmit, isSubmitting = false }: Props = $props();

	let amount = $state('0.00');
	let currency = $state<Currencies>('EUR');
	let status = $state<MembershipPaymentPaymentStatus>('succeeded');
	let notes = $state('');

	$effect(() => {
		if (open) {
			amount = String(subscription.plan.price);
			currency = subscription.plan.currency as Currencies;
			status = 'succeeded';
			notes = '';
		}
	});

	const currencyWarning = $derived(currency !== subscription.plan.currency);

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSubmit({ amount, currency, status, notes });
	}
</script>

<Dialog {open} onOpenChange={(v) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.recordPayment.title']()}</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="rp-amt">{m['orgAdmin.members.subscriptions.recordPayment.amount']()}</Label>
					<Input id="rp-amt" type="number" min="0" step="0.01" bind:value={amount} required />
				</div>
				<div class="space-y-1">
					<Label for="rp-cur">{m['orgAdmin.members.subscriptions.recordPayment.currency']()}</Label>
					<Select type="single" bind:value={currency as string}>
						<SelectTrigger id="rp-cur"><SelectValue /></SelectTrigger>
						<SelectContent>
							{#each CURRENCY_OPTIONS as opt}<SelectItem value={opt.value}>{opt.label}</SelectItem>{/each}
						</SelectContent>
					</Select>
				</div>
			</div>

			{#if currencyWarning}
				<p class="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
					{m['orgAdmin.members.subscriptions.recordPayment.currencyWarning']({
						planCurrency: subscription.plan.currency,
						selected: currency
					})}
				</p>
			{/if}

			<div class="space-y-1">
				<Label for="rp-status">{m['orgAdmin.members.subscriptions.recordPayment.status']()}</Label>
				<Select type="single" bind:value={status as string}>
					<SelectTrigger id="rp-status"><SelectValue /></SelectTrigger>
					<SelectContent>
						<SelectItem value="succeeded">Succeeded</SelectItem>
						<SelectItem value="pending">Pending</SelectItem>
						<SelectItem value="failed">Failed</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div class="space-y-1">
				<Label for="rp-notes">{m['orgAdmin.members.subscriptions.recordPayment.notes']()}</Label>
				<Textarea id="rp-notes" bind:value={notes} rows={2} />
			</div>

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>Cancel</Button>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.subscriptions.recordPayment.submit']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
```

- [ ] **Step 2: Commit**

```bash
pnpm check
git add src/lib/components/members/RecordPaymentModal.svelte
git commit -m "feat(subscriptions): add RecordPaymentModal"
```

---

## Task 13: CancelSubscriptionDialog

**Files:**
- Create: `src/lib/components/members/CancelSubscriptionDialog.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SubscriptionSchema, CancelSubscriptionSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import {
		RadioGroup,
		RadioGroupItem
	} from '$lib/components/ui/radio-group';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		subscription: SubscriptionSchema;
		open: boolean;
		onClose: () => void;
		onSubmit: (payload: CancelSubscriptionSchema) => void;
		isSubmitting?: boolean;
	}

	const { subscription, open, onClose, onSubmit, isSubmitting = false }: Props = $props();

	let mode = $state<'period_end' | 'immediate'>('period_end');
	let immediateAck = $state(false);

	$effect(() => {
		if (open) {
			mode = 'period_end';
			immediateAck = false;
		}
	});

	function fmtDate(d: string | null): string {
		return d ? new Date(d).toLocaleDateString() : '—';
	}

	function canSubmit(): boolean {
		if (mode === 'immediate') return immediateAck;
		return true;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!canSubmit()) return;
		onSubmit({ immediate: mode === 'immediate' });
	}
</script>

<Dialog {open} onOpenChange={(v) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.cancel.title']()}</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<RadioGroup bind:value={mode as string}>
				<div class="flex items-start gap-2">
					<RadioGroupItem id="cancel-pe" value="period_end" />
					<div>
						<Label for="cancel-pe">
							{m['orgAdmin.members.subscriptions.cancel.atPeriodEnd']({
								date: fmtDate(subscription.current_period_end)
							})}
						</Label>
						<p class="text-xs text-muted-foreground">
							{m['orgAdmin.members.subscriptions.cancel.atPeriodEndDesc']()}
						</p>
					</div>
				</div>
				<div class="flex items-start gap-2">
					<RadioGroupItem id="cancel-im" value="immediate" />
					<div>
						<Label for="cancel-im">{m['orgAdmin.members.subscriptions.cancel.immediate']()}</Label>
						<p class="text-xs text-muted-foreground">
							{m['orgAdmin.members.subscriptions.cancel.immediateDesc']()}
						</p>
					</div>
				</div>
			</RadioGroup>

			{#if mode === 'immediate'}
				<div class="flex items-center gap-2">
					<Checkbox id="cancel-ack" bind:checked={immediateAck} />
					<Label for="cancel-ack">
						{m['orgAdmin.members.subscriptions.cancel.immediateConfirm']()}
					</Label>
				</div>
			{/if}

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>
					{m['orgAdmin.members.subscriptions.cancel.keep']()}
				</Button>
				<Button type="submit" disabled={isSubmitting || !canSubmit()}>
					{#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.subscriptions.cancel.confirm']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
```

- [ ] **Step 2: Commit**

```bash
pnpm check
git add src/lib/components/members/CancelSubscriptionDialog.svelte
git commit -m "feat(subscriptions): add CancelSubscriptionDialog (period-end vs immediate)"
```

---

## Task 14: RefundPaymentDialog

**Files:**
- Create: `src/lib/components/members/RefundPaymentDialog.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipPaymentSchema, RefundSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		payment: MembershipPaymentSchema | null;
		open: boolean;
		onClose: () => void;
		onSubmit: (payload: RefundSchema) => void;
		isSubmitting?: boolean;
	}

	const { payment, open, onClose, onSubmit, isSubmitting = false }: Props = $props();
	let notes = $state('');

	$effect(() => {
		if (open) notes = '';
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSubmit({ notes });
	}
</script>

<Dialog {open} onOpenChange={(v) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.refund.title']()}</DialogTitle>
		</DialogHeader>
		<form onsubmit={handleSubmit} class="space-y-4">
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.members.subscriptions.refund.body']()}
			</p>
			{#if payment}
				<p class="text-sm">{payment.amount} {payment.currency}</p>
			{/if}
			<div class="space-y-1">
				<Label for="rf-notes">{m['orgAdmin.members.subscriptions.refund.notes']()}</Label>
				<Textarea id="rf-notes" bind:value={notes} rows={2} />
			</div>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>Cancel</Button>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.subscriptions.refund.submit']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
```

- [ ] **Step 2: Commit**

```bash
pnpm check
git add src/lib/components/members/RefundPaymentDialog.svelte
git commit -m "feat(subscriptions): add RefundPaymentDialog"
```

---

## Task 15: SubscriptionDrawer (compose everything)

**Files:**
- Create: `src/lib/components/members/SubscriptionDrawer.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsGetSubscription,
		organizationadminsubscriptionsListSubscriptionPayments,
		organizationadminsubscriptionsRecordSubscriptionPayment,
		organizationadminsubscriptionsCancelSubscription,
		organizationadminsubscriptionsPauseSubscription,
		organizationadminsubscriptionsResumeSubscription,
		organizationadminsubscriptionsRefundSubscriptionPayment
	} from '$lib/api/generated/sdk.gen';
	import type {
		SubscriptionSchema,
		MembershipPaymentSchema,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from 'lucide-svelte';
	import StatusBadge from './StatusBadge.svelte';
	import PaymentsTable from './PaymentsTable.svelte';
	import RecordPaymentModal from './RecordPaymentModal.svelte';
	import CancelSubscriptionDialog from './CancelSubscriptionDialog.svelte';
	import RefundPaymentDialog from './RefundPaymentDialog.svelte';
	import { getAvailableActions, formatPlanPrice, getDateLine } from '$lib/utils/subscriptions';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		subId: string;
		open: boolean;
		onClose: () => void;
	}

	const { organization, subId, open, onClose }: Props = $props();
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	const subKey = $derived(['organization', organization.slug, 'subscription', subId]);
	const paymentsKey = $derived(['organization', organization.slug, 'subscription', subId, 'payments']);

	const subQuery = createQuery(() => ({
		queryKey: subKey,
		queryFn: async () => {
			const res = await organizationadminsubscriptionsGetSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load subscription');
			return res.data as SubscriptionSchema;
		},
		enabled: open && !!accessToken
	}));

	const paymentsQuery = createQuery(() => ({
		queryKey: paymentsKey,
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListSubscriptionPayments({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load payments');
			return (res.data?.items ?? []) as MembershipPaymentSchema[];
		},
		enabled: open && !!accessToken
	}));

	const sub = $derived(subQuery.data);
	const payments = $derived(paymentsQuery.data ?? []);
	const actions = $derived(sub ? getAvailableActions(sub) : null);

	let recordOpen = $state(false);
	let cancelOpen = $state(false);
	let refundTarget = $state<MembershipPaymentSchema | null>(null);

	function invalidateAll() {
		queryClient.invalidateQueries({ queryKey: subKey });
		queryClient.invalidateQueries({ queryKey: paymentsKey });
		queryClient.invalidateQueries({
			queryKey: ['organization', organization.slug, 'subscriptions']
		});
	}

	const recordMut = createMutation(() => ({
		mutationFn: async (payload: Parameters<typeof organizationadminsubscriptionsRecordSubscriptionPayment>[0]['body']) => {
			const res = await organizationadminsubscriptionsRecordSubscriptionPayment({
				path: { slug: organization.slug, sub_id: subId },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to record payment');
			return res.data as MembershipPaymentSchema;
		},
		onSuccess: () => {
			invalidateAll();
			recordOpen = false;
		},
		onError: (err: Error) => alert(`Failed to record payment: ${err.message}`)
	}));

	const cancelMut = createMutation(() => ({
		mutationFn: async (payload: { immediate: boolean }) => {
			const res = await organizationadminsubscriptionsCancelSubscription({
				path: { slug: organization.slug, sub_id: subId },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to cancel');
			return res.data;
		},
		onSuccess: () => {
			invalidateAll();
			cancelOpen = false;
		},
		onError: (err: Error) => alert(`Failed to cancel: ${err.message}`)
	}));

	const pauseMut = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationadminsubscriptionsPauseSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to pause');
			return res.data;
		},
		onSuccess: invalidateAll,
		onError: (err: Error) => alert(`Failed to pause: ${err.message}`)
	}));

	const resumeMut = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationadminsubscriptionsResumeSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to resume');
			return res.data;
		},
		onSuccess: invalidateAll,
		onError: (err: Error) => alert(`Failed to resume: ${err.message}`)
	}));

	const refundMut = createMutation(() => ({
		mutationFn: async ({ paymentId, notes }: { paymentId: string; notes: string }) => {
			const res = await organizationadminsubscriptionsRefundSubscriptionPayment({
				path: { slug: organization.slug, payment_id: paymentId },
				body: { notes },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to refund');
			return res.data;
		},
		onSuccess: () => {
			invalidateAll();
			refundTarget = null;
		},
		onError: (err: Error) => alert(`Failed to refund: ${err.message}`)
	}));

	function fmtDate(d: string | null): string {
		return d ? new Date(d).toLocaleDateString() : '—';
	}
</script>

<Dialog {open} onOpenChange={(v) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-3xl">
		{#if subQuery.isLoading || !sub}
			<Loader2 class="h-5 w-5 animate-spin" />
		{:else}
			<DialogHeader>
				<DialogTitle>
					<div class="flex items-start justify-between gap-4">
						<div>
							<div class="text-base font-semibold">{sub.user_display_name}</div>
							<div class="text-xs text-muted-foreground">{sub.user_email}</div>
						</div>
						<StatusBadge status={sub.status} />
					</div>
				</DialogTitle>
			</DialogHeader>

			<div class="space-y-1 text-sm">
				<div>
					<span class="font-medium">{sub.plan.name}</span>
					<span class="text-muted-foreground"> · {formatPlanPrice(sub.plan)}</span>
				</div>
				{#each [getDateLine(sub)] as line}
					<div class="text-xs text-muted-foreground">
						{#if line.kind === 'renewal'}
							{m['subscriptions.dateLine.renewal']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'cancels'}
							{m['subscriptions.dateLine.cancels']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'period_ends'}
							{m['subscriptions.dateLine.periodEnds']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'paused_since'}
							{m['subscriptions.dateLine.pausedSince']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'ended'}
							{m['subscriptions.dateLine.ended']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'pending'}
							{m['subscriptions.dateLine.pending']()}
						{/if}
					</div>
				{/each}
			</div>

			<div class="flex flex-wrap gap-2">
				{#if actions?.recordPayment}
					<Button size="sm" onclick={() => (recordOpen = true)}>
						{m['orgAdmin.members.subscriptions.drawer.recordPayment']()}
					</Button>
				{/if}
				{#if actions?.pause}
					<Button size="sm" variant="outline" onclick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
						{m['orgAdmin.members.subscriptions.drawer.pause']()}
					</Button>
				{/if}
				{#if actions?.resume}
					<Button size="sm" variant="outline" onclick={() => resumeMut.mutate()} disabled={resumeMut.isPending}>
						{m['orgAdmin.members.subscriptions.drawer.resume']()}
					</Button>
				{/if}
				{#if actions?.cancel}
					<Button size="sm" variant="outline" onclick={() => (cancelOpen = true)}>
						{m['orgAdmin.members.subscriptions.drawer.cancel']()}
					</Button>
				{/if}
			</div>

			<div class="pt-2">
				<h4 class="mb-2 text-sm font-semibold">
					{m['orgAdmin.members.subscriptions.drawer.payments']()}
				</h4>
				{#if paymentsQuery.isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<PaymentsTable {payments} onRefund={(p) => (refundTarget = p)} />
				{/if}
			</div>

			<RecordPaymentModal
				subscription={sub}
				open={recordOpen}
				onClose={() => (recordOpen = false)}
				onSubmit={(p) => recordMut.mutate(p)}
				isSubmitting={recordMut.isPending}
			/>
			<CancelSubscriptionDialog
				subscription={sub}
				open={cancelOpen}
				onClose={() => (cancelOpen = false)}
				onSubmit={(p) => cancelMut.mutate(p)}
				isSubmitting={cancelMut.isPending}
			/>
			<RefundPaymentDialog
				payment={refundTarget}
				open={!!refundTarget}
				onClose={() => (refundTarget = null)}
				onSubmit={(p) => refundTarget && refundMut.mutate({ paymentId: refundTarget.id, notes: p.notes })}
				isSubmitting={refundMut.isPending}
			/>
		{/if}
	</DialogContent>
</Dialog>
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm check
git add src/lib/components/members/SubscriptionDrawer.svelte
git commit -m "feat(subscriptions): add SubscriptionDrawer (status header, lifecycle actions, payments)"
```

---

## Task 16: Mount SubscriptionsTab in members page

**Files:**
- Modify: `src/routes/(auth)/org/[slug]/admin/members/+page.svelte`

- [ ] **Step 1: Read the file** to find the existing tabs structure (lines around 159-200).

- [ ] **Step 2: Add the new tab**

Add import in the script section:

```svelte
import SubscriptionsTab from '$lib/components/members/SubscriptionsTab.svelte';
import { CreditCard } from 'lucide-svelte';
```

Inside the `<TabsList>` (next to the existing tab triggers, after "tiers"):

```svelte
<TabsTrigger value="subscriptions" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
	<CreditCard class="h-4 w-4" />
	<span class="hidden sm:inline">{m['orgAdmin.members.tabs.subscriptions']()}</span>
	<span class="sm:hidden">{m['orgAdmin.members.tabs.subscriptions']()}</span>
</TabsTrigger>
```

After the existing `<TabsContent value="tiers">` block:

```svelte
<TabsContent value="subscriptions" class="space-y-4">
	<SubscriptionsTab {organization} />
</TabsContent>
```

> Gate visibility: if `organization.permissions?.manage_subscriptions === false` AND user isn't owner, hide the trigger. The exact org-permission shape lives in the `OrganizationAdminDetailSchema` / page data — match how existing code reads permissions in this same file (it uses staff/owner checks today; if no fine-grained check, leave permission-gating to the backend and skip the trigger guard).

- [ ] **Step 3: Type-check + visual**

```bash
pnpm check
pnpm dev
```

Visit `/org/<slug>/admin/members`. New "Subscriptions" tab visible. Clicking it shows the list. Clicking "Create subscription" opens the modal; selecting a member + plan + submitting opens the drawer.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(auth)/org/[slug]/admin/members/+page.svelte
git commit -m "feat(subscriptions): wire SubscriptionsTab into members admin page"
```

---

## Task 17: MembershipCard (member-facing)

**Files:**
- Create: `src/lib/components/account/MembershipCard.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import StatusBadge from '$lib/components/members/StatusBadge.svelte';
	import { formatPlanPrice, getDateLine } from '$lib/utils/subscriptions';

	interface Props {
		sub: MySubscriptionSchema;
	}

	const { sub }: Props = $props();
	const line = $derived(getDateLine(sub));

	function fmtDate(d: string | null): string {
		return d ? new Date(d).toLocaleDateString() : '—';
	}
</script>

<Card>
	<CardContent class="p-4">
		<article aria-label={sub.organization_name}>
			<div class="flex items-start justify-between gap-3">
				<div>
					<h3 class="font-semibold">{sub.organization_name}</h3>
					<p class="text-sm text-muted-foreground">
						{sub.plan.name} · {formatPlanPrice(sub.plan)}
					</p>
				</div>
				<StatusBadge status={sub.status} />
			</div>

			<p class="mt-2 text-sm">
				{#if line.kind === 'renewal'}
					{m['subscriptions.dateLine.renewal']({ date: fmtDate(line.date) })}
				{:else if line.kind === 'cancels'}
					{m['subscriptions.dateLine.cancels']({ date: fmtDate(line.date) })}
				{:else if line.kind === 'period_ends'}
					{m['subscriptions.dateLine.periodEnds']({ date: fmtDate(line.date) })}
				{:else if line.kind === 'paused_since'}
					{m['subscriptions.dateLine.pausedSince']({ date: fmtDate(line.date) })}
				{:else if line.kind === 'ended'}
					{m['subscriptions.dateLine.ended']({ date: fmtDate(line.date) })}
				{:else if line.kind === 'pending'}
					{m['subscriptions.dateLine.pending']()}
				{/if}
			</p>

			{#if sub.status === 'past_due'}
				<p class="mt-1 text-xs text-muted-foreground">
					{m['account.memberships.contactOrg']()}
				</p>
			{/if}

			<div class="mt-3">
				<Button href="/org/{sub.organization_slug}" variant="outline" size="sm">
					{m['account.memberships.viewOrg']()}
				</Button>
			</div>
		</article>
	</CardContent>
</Card>
```

- [ ] **Step 2: Commit**

```bash
pnpm check
git add src/lib/components/account/MembershipCard.svelte
git commit -m "feat(subscriptions): add MembershipCard for /account/memberships"
```

---

## Task 18: /account/memberships route

**Files:**
- Create: `src/routes/(auth)/account/memberships/+page.ts`
- Create: `src/routes/(auth)/account/memberships/+page.svelte`

- [ ] **Step 1: Create `+page.ts`**

```ts
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async () => {
	return {};
};
```

- [ ] **Step 2: Create `+page.svelte`**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { meSubscriptionsListMyMembershipSubscriptions } from '$lib/api/generated/sdk.gen';
	import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import MembershipCard from '$lib/components/account/MembershipCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from 'lucide-svelte';

	const accessToken = $derived(authStore.accessToken);

	const subsQuery = createQuery(() => ({
		queryKey: ['me', 'memberships'],
		queryFn: async () => {
			const res = await meSubscriptionsListMyMembershipSubscriptions({
				query: { page_size: 50 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load memberships');
			return (res.data?.items ?? []) as MySubscriptionSchema[];
		},
		enabled: !!accessToken
	}));

	const subs = $derived(subsQuery.data ?? []);
</script>

<svelte:head>
	<title>{m['account.memberships.title']()}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-4 px-4 py-6">
	<h1 class="text-2xl font-bold">{m['account.memberships.title']()}</h1>

	{#if subsQuery.isLoading}
		<Loader2 class="h-5 w-5 animate-spin" />
	{:else if subs.length === 0}
		<div class="rounded-lg border p-6 text-center">
			<p class="font-medium">{m['account.memberships.empty.title']()}</p>
			<p class="mt-1 text-sm text-muted-foreground">{m['account.memberships.empty.body']()}</p>
			<Button href="/organizations" variant="outline" class="mt-4">
				{m['account.memberships.empty.cta']()}
			</Button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each subs as s (s.id)}
				<MembershipCard sub={s} />
			{/each}
		</div>
	{/if}
</div>
```

- [ ] **Step 3: Type-check + visual**

```bash
pnpm check
pnpm dev
```

Visit `/account/memberships` while logged in. Renders the list or the empty state.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(auth)/account/memberships/
git commit -m "feat(subscriptions): add /account/memberships page"
```

---

## Task 19: OrgMembershipInline + mount on org page

**Files:**
- Create: `src/lib/components/account/OrgMembershipInline.svelte`
- Modify: `src/routes/(public)/org/[slug]/+page.svelte`

- [ ] **Step 1: Implement `OrgMembershipInline.svelte`**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { meSubscriptionsGetMyOrganizationSubscription } from '$lib/api/generated/sdk.gen';
	import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import StatusBadge from '$lib/components/members/StatusBadge.svelte';
	import { formatPlanPrice, getDateLine } from '$lib/utils/subscriptions';

	interface Props {
		orgId: string;
		orgName: string;
	}

	const { orgId, orgName }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	const subQuery = createQuery(() => ({
		queryKey: ['me', 'org', orgId, 'subscription'],
		queryFn: async () => {
			const res = await meSubscriptionsGetMyOrganizationSubscription({
				path: { org_id: orgId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// 404 → return null (no subscription)
			if (res.error) return null;
			return res.data as MySubscriptionSchema;
		},
		enabled: !!accessToken,
		retry: false
	}));

	const sub = $derived(subQuery.data);

	function fmtDate(d: string | null): string {
		return d ? new Date(d).toLocaleDateString() : '—';
	}
</script>

{#if sub}
	{@const line = getDateLine(sub)}
	<Card>
		<CardContent class="p-4">
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				{m['orgPublic.yourMembership.title']()}
			</h3>
			<div class="mt-1 font-medium">{sub.plan.name}</div>
			<div class="text-sm text-muted-foreground">{formatPlanPrice(sub.plan)}</div>
			<div class="mt-2 flex items-center gap-2">
				<StatusBadge status={sub.status} />
				<span class="text-xs text-muted-foreground">
					{#if line.kind === 'renewal'}
						{m['subscriptions.dateLine.renewal']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'cancels'}
						{m['subscriptions.dateLine.cancels']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'period_ends'}
						{m['subscriptions.dateLine.periodEnds']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'paused_since'}
						{m['subscriptions.dateLine.pausedSince']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'ended'}
						{m['subscriptions.dateLine.ended']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'pending'}
						{m['subscriptions.dateLine.pending']()}
					{/if}
				</span>
			</div>
			<p class="mt-3 text-xs text-muted-foreground">
				{m['orgPublic.yourMembership.managedBy']({ org: orgName })}
			</p>
		</CardContent>
	</Card>
{/if}
```

- [ ] **Step 2: Mount on the org public page**

Read `src/routes/(public)/org/[slug]/+page.svelte`. Find the right column / sidebar area where context cards belong. Add at the top of the script:

```svelte
import OrgMembershipInline from '$lib/components/account/OrgMembershipInline.svelte';
```

And in the template (right column on desktop, top on mobile):

```svelte
{#if data.organization}
	<OrgMembershipInline orgId={data.organization.id} orgName={data.organization.name} />
{/if}
```

The component silently renders nothing when there's no sub or the user isn't logged in.

- [ ] **Step 3: Type-check + visual**

```bash
pnpm check
pnpm dev
```

Visit an org's public page where you have a subscription → card appears. Visit one where you don't → nothing renders.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/account/OrgMembershipInline.svelte src/routes/(public)/org/[slug]/+page.svelte
git commit -m "feat(subscriptions): inline 'Your membership' card on org public page"
```

---

## Task 20: E2E happy-path test

**Files:**
- Create: `tests/e2e/subscriptions.spec.ts`

- [ ] **Step 1: Read an existing E2E spec to match style**

Read any file under `tests/e2e/` to confirm the auth-helper / setup pattern (login, navigation). Match it.

- [ ] **Step 2: Implement happy path**

```ts
import { test, expect } from '@playwright/test';

test.describe('Subscriptions Phase 1', () => {
	test('admin creates plan, subscribes a member, records payment, cancels', async ({ page }) => {
		// Assume seed/login helper exists; mirror what other admin specs in this repo use.
		// If not, set test.skip() and document fixture work needed.
		test.skip(!process.env.E2E_ADMIN_AUTH, 'requires admin auth fixture');

		await page.goto('/org/test-org/admin/members');
		await page.getByRole('tab', { name: /tiers/i }).click();
		// Assume at least one tier exists in fixtures
		await page.getByRole('button', { name: /add plan/i }).first().click();
		await page.getByLabel('Name').fill('E2E Monthly');
		await page.getByLabel('Price').fill('10.00');
		await page.getByRole('button', { name: /create plan/i }).click();
		await expect(page.getByText('E2E Monthly')).toBeVisible();

		await page.getByRole('tab', { name: /subscriptions/i }).click();
		await page.getByRole('button', { name: /create subscription/i }).click();
		await page.getByPlaceholder(/type to search/i).fill('test@');
		await page.getByRole('option').first().click();
		await page.getByLabel('Plan').click();
		await page.getByRole('option', { name: /e2e monthly/i }).click();
		await page.getByRole('checkbox', { name: /record initial payment/i }).check();
		await page.getByRole('button', { name: /^create$/i }).click();

		// Drawer opens
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByText(/active|pending/i)).toBeVisible();

		// Cancel at period end
		await page.getByRole('button', { name: /^cancel$/i }).click();
		await page.getByRole('button', { name: /confirm cancellation/i }).click();
		await expect(page.getByText(/cancels on|cancelled/i)).toBeVisible();
	});

	test('member sees their membership at /account/memberships', async ({ page }) => {
		test.skip(!process.env.E2E_MEMBER_AUTH, 'requires member auth fixture');
		await page.goto('/account/memberships');
		await expect(page.getByRole('heading', { name: /my memberships/i })).toBeVisible();
	});
});
```

> **Note:** If the project has no test fixtures for admin/member auth, the tests will skip rather than fail. Track fixture setup as a follow-up.

- [ ] **Step 3: Commit**

```bash
pnpm check
git add tests/e2e/subscriptions.spec.ts
git commit -m "test(subscriptions): E2E admin + member happy paths"
```

---

## Task 21: Quality gate + manual verification

- [ ] **Step 1: Auto-fix lint/format**

Run: `make fix`
Expected: clean.

- [ ] **Step 2: Full check pass**

Run: `make check`
Expected: format-check, lint (--max-warnings 0), types, i18n-check, file-length all green. Fix any failures.

- [ ] **Step 3: Run unit tests**

Run: `make test`
Expected: all green. The subscription utility tests we wrote in Task 1 are included.

- [ ] **Step 4: Manual desktop walkthrough**

```bash
pnpm dev
```

In a desktop browser viewport, log in as an org owner/staff with `manage_subscriptions`:

1. `/org/<slug>/admin/members` → Tiers tab → expand a tier → "Add plan" → fill form → save. Plan card appears.
2. Edit the plan; archive it; create a second active plan.
3. Try to delete a plan that has subscribers → friendly error + offer to archive.
4. Subscriptions tab → "Create subscription" → pick a member → pick a plan → check "Record initial payment" → submit. Drawer opens.
5. In the drawer, record another payment. Verify status badge updates (PENDING → ACTIVE) and period_end advances.
6. Pause → status → Paused. Resume → status → Active.
7. Cancel "At end of period" → header shows "Cancels on …".
8. Open a `succeeded` payment row → Refund → status changes to refunded.

Log in as the same member-account:
9. `/account/memberships` → card visible with correct status and date copy.
10. `/org/<slug>` → "Your membership" card visible with correct status.

- [ ] **Step 5: Manual mobile walkthrough**

In a mobile viewport (Chrome DevTools or actual phone at the dev server's `0.0.0.0:5173` URL), repeat the flow. Verify:
- Plans grid → single column
- Subscriptions list → cards (no table)
- Drawer/modals fill the screen sensibly
- All buttons reachable; no horizontal scroll

- [ ] **Step 6: Accessibility manual pass**

- Keyboard-only: tab through all new screens; Enter/Space activate buttons; ESC closes modals.
- VoiceOver (macOS) or screen reader: status badges announce their label; date strings are spoken.
- Inspect badges in DevTools: contrast ≥ 4.5:1 for each tone.

- [ ] **Step 7: Open PR**

```bash
git push -u origin feature/subscriptions-phase1-ui
gh pr create --title "feat(subscriptions): Phase 1 UI (OFFLINE staff-managed)" --body "$(cat <<'EOF'
## Summary
Frontend for revel-backend PR #397 (Phase 1 OFFLINE subscriptions) + PR #405 (payments listing + MySubscriptionSchema enrichment).

- Admin: plans CRUD inside Tiers tab; new Subscriptions tab with search/filter, create modal, drawer with lifecycle actions (record payment, pause/resume, cancel, refund).
- Member: `/account/memberships` listing + inline "Your membership" card on `/org/[slug]`.

Walls off cleanly from backend PR #403 (Phases 2-4) so Stripe/portal/change-plan can layer on later.

Spec: `docs/superpowers/specs/2026-05-14-subscriptions-phase1-ui-design.md`
Plan: `docs/superpowers/plans/2026-05-14-subscriptions-phase1-ui.md`

Closes part of [issue #229 (revel-backend)] on the frontend side.

## Test plan
- [ ] `make fix && make check && make test`
- [ ] Manual admin walkthrough (plans CRUD, subscription create, lifecycle, refund) — desktop + mobile
- [ ] Manual member walkthrough (/account/memberships, org-page inline card) — desktop + mobile
- [ ] Keyboard navigation through all new modals
- [ ] Screen-reader: status badges announce labels
- [ ] Verify against backend on PR #405 branch until that lands on backend main

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

**Spec coverage checked:**
- Plans CRUD inside TiersTab ✓ (Tasks 4-6)
- Subscriptions tab + drawer + lifecycle ✓ (Tasks 9-16)
- Member listing + org inline card ✓ (Tasks 17-19)
- Status badge + utilities (action matrix, price formatter, date line) ✓ (Tasks 1, 3)
- i18n keys ✓ (Task 2)
- E2E + manual + accessibility verification ✓ (Tasks 20-21)
- Permission gating: handled at backend level + soft FE check in Task 16

**Known deviations from spec:**
- "Drawer" is implemented as a wide Dialog (no Sheet primitive available). Acceptable per codebase conventions.
- Error toasts: project uses `alert()` everywhere. Plan matches.
- Optimistic updates were specified for cancel/pause/resume. Plan uses invalidate-on-success rather than full optimistic state — simpler and still feels responsive given the small payload. Note as a follow-up if user feedback during walkthrough requires it.

**Backend gap #3** (org `membership_grace_period_days` / `membership_refund_policy`) intentionally out of scope.

---

End of plan.
