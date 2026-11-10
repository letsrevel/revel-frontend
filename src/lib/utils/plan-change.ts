import * as m from '$lib/paraglide/messages.js';
import type {
	PlanSchema,
	SubscriptionPlanChangeRefusalCode,
	SubscriptionSchema
} from '$lib/api/generated/types.gen';
import { backendMessage } from './api-error-detail';

/**
 * Whether staff can move a subscription to another plan right now.
 *
 * Mirrors the backend's check order (`plan_change_online`, `subscription_terminal`,
 * `subscription_paused`): an ONLINE plan is changed by the member themselves, so
 * that note wins over the status of the row.
 */
export type ChangePlanState = 'allowed' | 'online' | 'paused' | 'terminal';

export function changePlanState(sub: Pick<SubscriptionSchema, 'status' | 'plan'>): ChangePlanState {
	if (sub.plan.payment_method === 'online') return 'online';
	if (sub.status === 'cancelled' || sub.status === 'expired') return 'terminal';
	if (sub.status === 'paused') return 'paused';
	return 'allowed';
}

/**
 * The plans a subscription can move to: same payment method and currency as the
 * current plan (the backend refuses a mismatch), never the current plan itself and
 * never an archived one.
 */
export function eligibleChangePlans(plans: PlanSchema[], current: PlanSchema): PlanSchema[] {
	return plans.filter(
		(p) =>
			!!p.id &&
			p.id !== current.id &&
			p.is_active !== false &&
			p.payment_method === current.payment_method &&
			p.currency === current.currency
	);
}

/** Group plans by tier, keeping the backend's order (tier asc, plan asc). */
export function groupPlansByTier(
	plans: PlanSchema[]
): { tierId: string; tierName: string; plans: PlanSchema[] }[] {
	// A Map iterates in insertion order, so the first appearance of a tier fixes its place.
	const groups = new Map<string, { tierId: string; tierName: string; plans: PlanSchema[] }>();
	for (const p of plans) {
		let group = groups.get(p.tier_id);
		if (!group) {
			group = { tierId: p.tier_id, tierName: p.tier_name, plans: [] };
			groups.set(p.tier_id, group);
		}
		group.plans.push(p);
	}
	return [...groups.values()];
}

/** The plan's cap on concurrent subscriptions is reached (`max_subscriptions` null = unlimited). */
export function isPlanSoldOut(
	plan: Pick<PlanSchema, 'max_subscriptions' | 'active_subscription_count'>
): boolean {
	return plan.max_subscriptions != null && plan.active_subscription_count >= plan.max_subscriptions;
}

const REFUSAL_CODES: readonly SubscriptionPlanChangeRefusalCode[] = [
	'tier_follows_subscription',
	'plan_change_online',
	'subscription_terminal',
	'subscription_paused',
	'plan_unchanged',
	'plan_archived',
	'plan_payment_method_mismatch',
	'plan_currency_mismatch'
];

/** The machine-readable `code` of a 409 refusal, or null for any other body. */
export function planChangeRefusalCode(error: unknown): SubscriptionPlanChangeRefusalCode | null {
	if (!error || typeof error !== 'object' || !('code' in error)) return null;
	const { code }: { code: unknown } = error;
	return REFUSAL_CODES.find((c) => c === code) ?? null;
}

/**
 * Staff-facing sentence for a refused plan change. Keyed on `code` (the sibling
 * `detail` is translated server-side) and on the HTTP status for the two
 * code-less refusals: 400 = the plan's cap is reached, 404 = unknown plan or sub.
 */
export function planChangeErrorMessage(error: unknown, status: number | undefined): string {
	switch (planChangeRefusalCode(error)) {
		case 'tier_follows_subscription':
			return m['subscriptionChangePlan.errors.tierFollows']();
		case 'plan_change_online':
			return m['subscriptionChangePlan.errors.online']();
		case 'subscription_terminal':
			return m['subscriptionChangePlan.errors.terminal']();
		case 'subscription_paused':
			return m['subscriptionChangePlan.errors.paused']();
		case 'plan_unchanged':
			return m['subscriptionChangePlan.errors.unchanged']();
		case 'plan_archived':
			return m['subscriptionChangePlan.errors.archived']();
		case 'plan_payment_method_mismatch':
			return m['subscriptionChangePlan.errors.methodMismatch']();
		case 'plan_currency_mismatch':
			return m['subscriptionChangePlan.errors.currencyMismatch']();
		default:
			break;
	}
	if (status === 400) return m['subscriptionChangePlan.errors.soldOut']();
	if (status === 404) return m['subscriptionChangePlan.errors.notFound']();
	return backendMessage(error) || m['subscriptionChangePlan.errors.generic']();
}
