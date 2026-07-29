import * as m from '$lib/paraglide/messages.js';
import { getDateLocale } from './date';
import type {
	MembershipStatus,
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
 * Is this *membership* row suspended by staff?
 *
 * Exactly the two `OrganizationMember.MembershipStatus` values
 * `events.service.subscription_uncancel._assert_membership_allows_renewal`
 * refuses with a 403 — a suspended member must not be put back on the renewal
 * clock, because that would bill them for access they do not currently have.
 * Note this is the *member row's* status, which is a different axis from the
 * subscription's own `SubscriptionStatus`: the two can disagree (see
 * `needsMembershipSuspendedNotice`).
 */
export function isMembershipSuspended(memberStatus?: MembershipStatus | null): boolean {
	return memberStatus === 'paused' || memberStatus === 'banned';
}

/**
 * Would `POST …/uncancel` actually change something on this row?
 *
 * The four guards of `events.service.subscription_uncancel.uncancel_subscription`,
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
 * 4. **membership suspended → 403** (`_assert_membership_allows_renewal`, whose
 *    copy is caller-aware: the staff endpoint answers `This membership is
 *    suspended. Restore the member before resuming renewals.`, the member one
 *    `…Contact the organizers to have it restored first.`).
 *    Reachable because `_mirror_status_to_subscriptions` deliberately *skips* a
 *    subscription that is already scheduled to cancel: a staff PAUSE then leaves
 *    the member row PAUSED while the subscription stays ACTIVE/PAST_DUE with a
 *    cancellation booked — precisely the state guards 1–3 all wave through.
 *    Only the caller can supply this, and both surfaces now can: the member card
 *    passes its own `MyMembershipSchema.status`, the admin drawer the annotated
 *    `SubscriptionSchema.member_status`. An omitted status — and equally an
 *    explicit `null`, which means *no member row exists* and is emphatically not
 *    "active" — is "cannot pre-gate, let the server decide", so it withholds
 *    nothing; only `paused`/`banned` do. Pre-gating never makes the 403
 *    unreachable anyway: the member row can be suspended between load and click.
 *
 * Note the backend does *not* gate on payment method *here*: an OFFLINE row takes
 * the purely local path, so withdrawing this action from OFFLINE members is a
 * frontend policy decision (see `getMemberActions`), not a backend constraint.
 * That is true of `uncancel` specifically — the sibling change-plan and revive
 * endpoints each refuse an OFFLINE row outright in their own controller.
 */
export function canUncancel(
	sub: {
		status: SubscriptionStatus;
		cancel_at_period_end?: boolean;
		plan: { is_active?: boolean };
	},
	memberStatus?: MembershipStatus | null
): boolean {
	if (sub.status === 'cancelled' || sub.status === 'expired') return false;
	if (!sub.cancel_at_period_end) return false;
	if (sub.plan.is_active === false) return false;
	return !isMembershipSuspended(memberStatus);
}

/**
 * Staff action matrix for one subscription row.
 *
 * `memberStatus` is the *member row's* status — the admin drawer passes the
 * annotated `SubscriptionSchema.member_status`. Like `getMemberActions`, it only
 * feeds guard 4 of `canUncancel`, so it stays optional and an omitted one
 * changes nothing.
 */
export function getAvailableActions(
	sub: MySubscriptionSchema | SubscriptionSchema,
	memberStatus?: MembershipStatus | null
): ActionSet {
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
		uncancel: base.uncancel && canUncancel(sub, memberStatus)
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

/**
 * Status presentation lives in its own module (this file is at its 500-line
 * cap), but `$lib/utils/subscriptions` stays the single documented import site
 * for everything subscription-shaped, so it is re-exported here.
 */
export {
	getStatusConfig,
	getStatusLabel,
	STATUS_ORDER,
	type StatusConfig,
	type StatusTone
} from './subscription-status';

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
 * ONLINE/OFFLINE-aware member action matrix. Every withdrawal below mirrors a
 * refusal the backend would actually answer with, so no button here can only 400.
 *
 * OFFLINE subscriptions are managed by the organization, and for change-plan that
 * is now the backend's rule as well: `me_subscriptions.change_plan` refuses an
 * OFFLINE row with a 400 ("This subscription is managed by the organization…")
 * because an offline swap is immediate and fee-free, so a self-service
 * Monthly→Annual switch would turn one staff-recorded monthly payment into twelve
 * months of membership. That check sits in the *controller*, ahead of the service
 * — tracing it from `_validate_change_plan_state` will not find it.
 *
 * `_validate_change_plan_state` refuses, in its own order: a terminal row (which
 * the member endpoint's queryset already 404s before the service is reached),
 * PAUSED, PAST_DUE (see the `past_due` case), a scheduled cancellation, an
 * already-pending change, and a change to the plan the row is already on. Each
 * has a counterpart below.
 *
 * `uncancel` keeps the same ONLINE-only fence even though the backend would
 * accept it on an OFFLINE row: an OFFLINE cancellation can only have been
 * scheduled by staff, and this surface never lets a member overrule a decision
 * the organization made on their behalf. Staff undo it from the drawer instead.
 *
 * `memberStatus` is the caller's own `MyMembershipSchema.status` — the member
 * row that owns this subscription. It only feeds guard 4 of `canUncancel`
 * (suspended membership → 403); every other action is unaffected, so an omitted
 * status changes nothing.
 */
export function getMemberActions(
	sub: MySubscriptionSchema,
	now: Date = new Date(),
	memberStatus?: MembershipStatus | null
): MemberActionSet {
	// Withdrawn wholesale. Not merely a house style any more: the change-plan and
	// revive controllers both 400 an OFFLINE row, and there is no Stripe portal to
	// send an offline member to. What remains — `uncancel` — is this surface's own
	// policy (see `canUncancel`).
	if (sub.plan.payment_method !== 'online') return NO_MEMBER_ACTIONS;
	switch (sub.status) {
		case 'active':
			// A scheduled cancellation is no longer a dead end (#808): the way back is
			// `uncancel`, which is why `cancel` stays withdrawn here — renewal is
			// already off, so the only meaningful moves are the portal and undoing it.
			if (sub.cancel_at_period_end) {
				return {
					...NO_MEMBER_ACTIONS,
					manageBilling: true,
					uncancel: canUncancel(sub, memberStatus)
				};
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
				return {
					...NO_MEMBER_ACTIONS,
					manageBilling: true,
					uncancel: canUncancel(sub, memberStatus)
				};
			}
			// No change-plan, and the backend now agrees: `_validate_change_plan_state`
			// refuses PAST_DUE outright. An upgrade invoices only the proration delta,
			// and settling *that* invoice revives the row to ACTIVE (PAST_DUE is in
			// `_apply_invoice_outcome`'s revivable set) while the lapsed renewal invoice
			// stays unpaid and the period anchor stays in the past — a false ACTIVE that
			// also hands over the pricier tier and clears the dunning warning. Settling
			// the outstanding invoice in the portal is the way through, which is why
			// `manageBilling` is the action that stays.
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

/** Subscription statuses where nothing is left to restore. */
const TERMINAL_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ['cancelled', 'expired'];

/**
 * Should the card say, in words, that the *membership* is suspended?
 *
 * A withdrawn button teaches nothing, and this is the one case where the member
 * cannot infer the reason from anything else on the card: because
 * `_mirror_status_to_subscriptions` skips a subscription that is already
 * scheduled to cancel, a staff PAUSE can leave the member row PAUSED while the
 * subscription itself stays ACTIVE/PAST_DUE — so the status badge reads "Active",
 * `pausedHint` (which keys off the *subscription*) never fires, and yet every
 * renewal-restoring action is a guaranteed 403.
 *
 * Withdrawn where it would be redundant or untrue: a subscription that is itself
 * PAUSED already says so via `pausedHint`, and a terminal one has no renewal left
 * to restore (a BANNED member's subscriptions are terminalized by
 * `cancel_subscriptions_for_membership_loss`, so that is the usual ban shape).
 */
export function needsMembershipSuspendedNotice(
	sub: Pick<MySubscriptionSchema, 'status'> | null | undefined,
	memberStatus?: MembershipStatus | null
): boolean {
	if (!sub || !isMembershipSuspended(memberStatus)) return false;
	if (sub.status === 'paused') return false;
	return !TERMINAL_SUBSCRIPTION_STATUSES.includes(sub.status);
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
