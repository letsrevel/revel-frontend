import * as m from '$lib/paraglide/messages.js';
import { getDateLocale } from './date';
import type {
	MySubscriptionSchema,
	SubscriptionSchema,
	PlanSchema,
	SubscriptionStatus,
	PeriodUnit
} from '$lib/api/generated/types.gen';

export type { SubscriptionStatus };

export interface ActionSet {
	recordPayment: boolean;
	pause: boolean;
	resume: boolean;
	cancel: boolean;
	revive: boolean;
}

const ACTION_MATRIX: Record<SubscriptionStatus, ActionSet> = {
	pending: { recordPayment: true, pause: false, resume: false, cancel: true, revive: false },
	active: { recordPayment: true, pause: true, resume: false, cancel: true, revive: false },
	past_due: { recordPayment: true, pause: false, resume: false, cancel: true, revive: false },
	paused: { recordPayment: false, pause: false, resume: true, cancel: true, revive: false },
	cancelled: { recordPayment: false, pause: false, resume: false, cancel: false, revive: false },
	expired: { recordPayment: false, pause: false, resume: false, cancel: false, revive: true }
};

export function getAvailableActions(sub: MySubscriptionSchema | SubscriptionSchema): ActionSet {
	const base = ACTION_MATRIX[sub.status];
	// ONLINE payments arrive via Stripe webhooks — hand-recording would duplicate.
	if (sub.plan.payment_method === 'online') {
		return { ...base, recordPayment: false };
	}
	return base;
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
}

const NO_MEMBER_ACTIONS: MemberActionSet = {
	manageBilling: false,
	changePlan: false,
	cancel: false,
	revive: false
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
 */
export function getMemberActions(
	sub: MySubscriptionSchema,
	now: Date = new Date()
): MemberActionSet {
	if (sub.plan.payment_method !== 'online') return NO_MEMBER_ACTIONS;
	switch (sub.status) {
		case 'active':
			if (sub.cancel_at_period_end) return { ...NO_MEMBER_ACTIONS, manageBilling: true };
			return { manageBilling: true, changePlan: !sub.pending_plan_id, cancel: true, revive: false };
		case 'past_due':
			// Deliberately stricter than the BE preflight, which would accept a change-plan
			// here: settle the failed payment in the portal first, then switch plans.
			return { ...NO_MEMBER_ACTIONS, manageBilling: true, cancel: true };
		case 'expired':
			return { ...NO_MEMBER_ACTIONS, revive: isWithinRevivalWindow(sub, now) };
		default:
			return NO_MEMBER_ACTIONS;
	}
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
