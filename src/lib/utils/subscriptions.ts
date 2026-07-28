import * as m from '$lib/paraglide/messages.js';
import { getDateLocale } from './date';
import type {
	MySubscriptionSchema,
	SubscriptionSchema,
	PlanSchema,
	PublicPlanSchema,
	SubscriptionStatus,
	SubscriptionActivationPendingSchema,
	PeriodUnit
} from '$lib/api/generated/types.gen';

export type { SubscriptionStatus };

export interface ActionSet {
	recordPayment: boolean;
	pause: boolean;
	resume: boolean;
	cancel: boolean;
	revive: boolean;
	uncancel: boolean;
}

const NO_ACTIONS: ActionSet = {
	recordPayment: false,
	pause: false,
	resume: false,
	cancel: false,
	revive: false,
	uncancel: false
};

// `uncancel` on this axis is only "the row is not terminal": whether there is a
// scheduled cancellation to undo at all is a per-row fact, applied by
// `canUncancel` below.
const ACTION_MATRIX: Record<SubscriptionStatus, ActionSet> = {
	pending: {
		recordPayment: true,
		pause: false,
		resume: false,
		cancel: true,
		revive: false,
		uncancel: true
	},
	active: {
		recordPayment: true,
		pause: true,
		resume: false,
		cancel: true,
		revive: false,
		uncancel: true
	},
	past_due: {
		recordPayment: true,
		pause: false,
		resume: false,
		cancel: true,
		revive: false,
		uncancel: true
	},
	paused: {
		recordPayment: false,
		pause: false,
		resume: true,
		cancel: true,
		revive: false,
		uncancel: true
	},
	cancelled: {
		recordPayment: false,
		pause: false,
		resume: false,
		cancel: false,
		revive: false,
		uncancel: false
	},
	expired: {
		recordPayment: false,
		pause: false,
		resume: false,
		cancel: false,
		revive: true,
		uncancel: false
	}
};

/**
 * Would `POST …/uncancel` actually change something on this row?
 *
 * The three guards of `events.service.subscription_uncancel.uncancel_subscription`,
 * in the backend's own order:
 *
 * 1. **terminal row → 400** (`Cannot resume renewal on a cancelled or expired
 *    subscription.`). Member-side it never even reaches the service: the endpoint's
 *    queryset `.exclude(status__in=TERMINAL_STATUSES)` turns it into a 404.
 * 2. **not scheduled to cancel → 200 *unchanged***. Not an error, but a button
 *    that provably does nothing is worse than no button, so it is withdrawn.
 * 3. **plan archived since → 400** (`This plan is archived and no longer accepts
 *    new subscriptions.`) — keeping the renewal alive would go on billing a
 *    retired plan. `is_active` is optional in the generated schema (it carries a
 *    Django default), so only an explicit `false` withdraws the action.
 *
 * Note the backend does *not* gate on payment method: an OFFLINE row takes the
 * purely local path. The ONLINE/OFFLINE split on the member surface is a frontend
 * policy decision (see `getMemberActions`), not a backend constraint.
 */
export function canUncancel(sub: {
	status: SubscriptionStatus;
	cancel_at_period_end?: boolean;
	plan: { is_active?: boolean };
}): boolean {
	if (sub.status === 'cancelled' || sub.status === 'expired') return false;
	if (!sub.cancel_at_period_end) return false;
	return sub.plan.is_active !== false;
}

export function getAvailableActions(sub: MySubscriptionSchema | SubscriptionSchema): ActionSet {
	// A status the client doesn't know yet (backend enum grew) offers nothing
	// rather than crashing on a spread of `undefined`.
	const base = ACTION_MATRIX[sub.status] ?? NO_ACTIONS;
	return {
		...base,
		// ONLINE payments arrive via Stripe webhooks — hand-recording would duplicate.
		recordPayment: base.recordPayment && sub.plan.payment_method !== 'online',
		// Pausing a row that is already scheduled to cancel would strand it
		// PAUSED+cancel_at_period_end, where the grace-expiry sweep — which only walks
		// ACTIVE/PAST_DUE — can never retire it, so `pause_subscription` refuses it
		// outright. Renewal has to be switched back on first — which is exactly what
		// `uncancel` now offers, so the two are never both available.
		pause: base.pause && !sub.cancel_at_period_end,
		uncancel: base.uncancel && canUncancel(sub)
	};
}

/** Localized billing-period label, pluralized on `period_count`. */
function periodLabel(unit: PeriodUnit, count: number): string {
	if (unit === 'year') {
		return count === 1
			? m['subscriptions.period.year']()
			: m['subscriptions.period.years']({ n: count });
	}
	return count === 1
		? m['subscriptions.period.month']()
		: m['subscriptions.period.months']({ n: count });
}

/**
 * Render a plan as "<amount> / <period>", e.g. "€10.00 / month".
 *
 * Both halves follow the active UI language: the amount is pinned to
 * `getDateLocale()` like every other currency helper (so SSR and CSR agree,
 * regardless of the server's ICU locale), and the period label comes from the
 * message catalog rather than a hardcoded English table.
 */
export function formatPlanPrice(
	plan: Pick<PlanSchema, 'price' | 'currency' | 'period_unit' | 'period_count'>
): string {
	const amount = new Intl.NumberFormat(getDateLocale(), {
		style: 'currency',
		currency: plan.currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(Number(plan.price));
	return `${amount} / ${periodLabel(plan.period_unit, plan.period_count ?? 1)}`;
}

export type StatusTone = 'green' | 'blue' | 'amber' | 'gray' | 'red' | 'muted';

export interface StatusConfig {
	tone: StatusTone;
	className: string;
}

const STATUS_CONFIG: Record<SubscriptionStatus, StatusConfig> = {
	active: {
		tone: 'green',
		className: 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
	},
	pending: {
		tone: 'blue',
		className: 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
	},
	past_due: {
		tone: 'amber',
		className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
	},
	paused: {
		tone: 'gray',
		className: 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
	},
	cancelled: { tone: 'muted', className: 'bg-muted text-muted-foreground' },
	expired: {
		tone: 'red',
		className: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100'
	}
};

export function getStatusConfig(status: SubscriptionStatus): StatusConfig {
	return STATUS_CONFIG[status];
}

export type DateLineKind =
	'renewal' | 'cancels' | 'period_ends' | 'paused_since' | 'ended' | 'pending';

export interface DateLine {
	kind: DateLineKind;
	date: string | null;
}

export function getDateLine(sub: MySubscriptionSchema | SubscriptionSchema): DateLine {
	if (sub.status === 'pending') return { kind: 'pending', date: sub.current_period_end ?? null };
	if (sub.status === 'paused') return { kind: 'paused_since', date: sub.updated_at };
	if (sub.status === 'cancelled' || sub.status === 'expired') {
		return { kind: 'ended', date: sub.cancelled_at ?? sub.updated_at };
	}
	if (sub.status === 'past_due')
		return { kind: 'period_ends', date: sub.current_period_end ?? null };
	// active
	if (sub.cancel_at_period_end) return { kind: 'cancels', date: sub.current_period_end ?? null };
	return { kind: 'renewal', date: sub.current_period_end ?? null };
}

/** Actions a member may take on their own subscription from the account hub. */
export interface MemberActionSet {
	manageBilling: boolean;
	changePlan: boolean;
	cancel: boolean;
	revive: boolean;
	resumePayment: boolean;
	uncancel: boolean;
}

const NO_MEMBER_ACTIONS: MemberActionSet = {
	manageBilling: false,
	changePlan: false,
	cancel: false,
	revive: false,
	resumePayment: false,
	uncancel: false
};

/** Strictly before the deadline; only an `expired` row can be revived. */
export function isWithinRevivalWindow(
	sub: Pick<MySubscriptionSchema, 'status' | 'revival_deadline'>,
	now: Date = new Date()
): boolean {
	if (sub.status !== 'expired' || !sub.revival_deadline) return false;
	return now.getTime() < new Date(sub.revival_deadline).getTime();
}

/**
 * ONLINE/OFFLINE-aware member action matrix. OFFLINE subscriptions are managed
 * by the organization; the backend rejects change-plan while a change is
 * pending or renewal is switched off (`_validate_change_plan_state`), so
 * those combinations never render a button that can only 400.
 *
 * `uncancel` keeps the same ONLINE-only fence even though the backend would
 * accept it on an OFFLINE row: an OFFLINE cancellation can only have been
 * scheduled by staff, and this surface never lets a member overrule a decision
 * the organization made on their behalf. Staff undo it from the drawer instead.
 */
export function getMemberActions(
	sub: MySubscriptionSchema,
	now: Date = new Date()
): MemberActionSet {
	if (sub.plan.payment_method !== 'online') return NO_MEMBER_ACTIONS;
	switch (sub.status) {
		case 'active':
			// A scheduled cancellation is no longer a dead end (#808): the way back is
			// `uncancel`, which is why `cancel` stays withdrawn here — renewal is
			// already off, so the only meaningful moves are the portal and undoing it.
			if (sub.cancel_at_period_end) {
				return { ...NO_MEMBER_ACTIONS, manageBilling: true, uncancel: canUncancel(sub) };
			}
			return {
				...NO_MEMBER_ACTIONS,
				manageBilling: true,
				changePlan: !sub.pending_plan_id,
				cancel: true
			};
		case 'past_due':
			// Same shape as ACTIVE: once renewal is off, cancelling again says nothing
			// the row does not already say, and undoing it is the action that does.
			if (sub.cancel_at_period_end) {
				return { ...NO_MEMBER_ACTIONS, manageBilling: true, uncancel: canUncancel(sub) };
			}
			// Deliberately stricter than the BE preflight, which would accept a change-plan
			// here: settle the failed payment in the portal first, then switch plans.
			return { ...NO_MEMBER_ACTIONS, manageBilling: true, cancel: true };
		case 'expired':
			return { ...NO_MEMBER_ACTIONS, revive: isWithinRevivalWindow(sub, now) };
		case 'pending':
			// The row an abandoned hosted Checkout left behind — whether it came from
			// the subscribe path or from a revival (which flips the row PENDING before
			// payment). Re-POSTing subscribe with this row's own plan hands back the
			// still-open session (`_maybe_resume_pending_checkout`), so the card is a
			// way back to Stripe instead of a dead end (#694).
			return { ...NO_MEMBER_ACTIONS, resumePayment: true };
		default:
			return NO_MEMBER_ACTIONS;
	}
}

/**
 * Could this member switch onto `plan` from `sub` right now?
 *
 * Mirrors `ChangePlanDialog`'s own candidate filter (a *different* plan, billed
 * online, in the currency the Stripe subscription already runs in) on top of
 * `getMemberActions().changePlan`, and additionally drops plans the dialog would
 * only render disabled. That keeps the org page from linking a member into a
 * change-plan flow that cannot offer the plan they clicked from — the same
 * "never render a control that can only fail" rule the action matrix follows.
 */
export function canSwitchToPlan(
	sub: MySubscriptionSchema,
	plan: Pick<PublicPlanSchema, 'id' | 'payment_method' | 'currency' | 'sold_out' | 'sales_status'>,
	now: Date = new Date()
): boolean {
	if (!getMemberActions(sub, now).changePlan) return false;
	return (
		Boolean(plan.id) &&
		plan.id !== sub.plan_id &&
		plan.payment_method === 'online' &&
		plan.currency === sub.plan.currency &&
		!plan.sold_out &&
		plan.sales_status === 'open'
	);
}

/** Price normalized per month — the backend's `_monthly_equivalent_price`. */
export function monthlyEquivalent(
	plan: Pick<PlanSchema, 'price' | 'period_unit' | 'period_count'>
): number {
	const months = (plan.period_unit === 'year' ? 12 : 1) * (plan.period_count ?? 1);
	return Number(plan.price) / months;
}

/** Upgrade = costs strictly more per month; ties are downgrades (BE semantics). */
export function classifyPlanChange(
	current: Pick<PlanSchema, 'price' | 'period_unit' | 'period_count'>,
	target: Pick<PlanSchema, 'price' | 'period_unit' | 'period_count'>
): 'upgrade' | 'downgrade' {
	return monthlyEquivalent(target) > monthlyEquivalent(current) ? 'upgrade' : 'downgrade';
}

/**
 * The one value `SubscriptionActivationPendingSchema.code` may carry.
 *
 * Typed against the generated literal rather than written as a bare string, so
 * a backend rename lands as a compile error here instead of as a silently
 * never-matching predicate.
 */
const ACTIVATION_PENDING_CODE: NonNullable<SubscriptionActivationPendingSchema['code']> =
	'subscription_activation_pending';

/**
 * Is this subscribe refusal the "you already paid, the webhook is still in
 * flight" 409?
 *
 * The member has been charged and only the activation webhooks are outstanding,
 * so this must never be rendered as a failure — the caller switches to its
 * "confirming your subscription" state instead. Keyed strictly on the
 * machine-readable `code`: the sibling `detail` is translated, so matching on it
 * would work in English and silently stop working in every other language.
 */
export function isSubscriptionActivationPending(error: unknown): boolean {
	if (!error || typeof error !== 'object' || !('code' in error)) return false;
	const { code }: { code: unknown } = error;
	return code === ACTIVATION_PENDING_CODE;
}
