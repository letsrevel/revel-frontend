import { describe, it, expect } from 'vitest';
import {
	getAvailableActions,
	canUncancel,
	formatPlanPrice,
	getStatusConfig,
	getDateLine,
	getMemberActions,
	isFreePlan,
	isLifetimePlan,
	isMembershipSuspended,
	isWithinRevivalWindow,
	monthlyEquivalent,
	needsMembershipSuspendedNotice,
	classifyPlanChange
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

interface MakeSubOptions extends Partial<MySubscriptionSchema> {
	status: MySubscriptionSchema['status'];
	payment_method?: 'online' | 'offline';
}

function makeSub({
	status,
	payment_method = 'offline',
	...over
}: MakeSubOptions): MySubscriptionSchema {
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
		plan: { ...basePlan, payment_method },
		organization_name: 'Sunset Yoga',
		organization_slug: 'sunset-yoga',
		organization_logo_url: null,
		...over
	} as MySubscriptionSchema;
}

describe('getAvailableActions', () => {
	// `uncancel` is false throughout: none of these rows carries a scheduled
	// cancellation, and the backend answers such a call with an unchanged 200.
	it.each([
		[
			'pending',
			{
				recordPayment: true,
				pause: false,
				resume: false,
				cancel: true,
				revive: false,
				uncancel: false
			}
		],
		[
			'active',
			{
				recordPayment: true,
				pause: true,
				resume: false,
				cancel: true,
				revive: false,
				uncancel: false
			}
		],
		[
			'past_due',
			{
				recordPayment: true,
				pause: false,
				resume: false,
				cancel: true,
				revive: false,
				uncancel: false
			}
		],
		[
			'paused',
			{
				recordPayment: false,
				pause: false,
				resume: true,
				cancel: true,
				revive: false,
				uncancel: false
			}
		],
		[
			'cancelled',
			{
				recordPayment: false,
				pause: false,
				resume: false,
				cancel: false,
				revive: false,
				uncancel: false
			}
		],
		[
			'expired',
			{
				recordPayment: false,
				pause: false,
				resume: false,
				cancel: false,
				revive: true,
				uncancel: false
			}
		]
	])('returns the right action set for %s', (status, expected) => {
		expect(getAvailableActions(makeSub({ status: status as never }))).toEqual(expected);
	});
});

describe('getAvailableActions online/offline', () => {
	it('offers recordPayment for offline active subs only', () => {
		expect(
			getAvailableActions(makeSub({ status: 'active', payment_method: 'offline' })).recordPayment
		).toBe(true);
		expect(
			getAvailableActions(makeSub({ status: 'active', payment_method: 'online' })).recordPayment
		).toBe(false);
	});

	it('offers revive only for expired subs, any payment method', () => {
		expect(
			getAvailableActions(makeSub({ status: 'expired', payment_method: 'offline' })).revive
		).toBe(true);
		expect(
			getAvailableActions(makeSub({ status: 'expired', payment_method: 'online' })).revive
		).toBe(true);
		expect(
			getAvailableActions(makeSub({ status: 'active', payment_method: 'offline' })).revive
		).toBe(false);
		expect(
			getAvailableActions(makeSub({ status: 'cancelled', payment_method: 'online' })).revive
		).toBe(false);
	});

	it('keeps pause/resume/cancel identical across payment methods', () => {
		for (const pm of ['online', 'offline'] as const) {
			const active = getAvailableActions(makeSub({ status: 'active', payment_method: pm }));
			expect(active).toMatchObject({ pause: true, resume: false, cancel: true });
			const paused = getAvailableActions(makeSub({ status: 'paused', payment_method: pm }));
			expect(paused).toMatchObject({ pause: false, resume: true, cancel: true });
		}
	});
});

describe('getAvailableActions with a scheduled cancellation', () => {
	// `pause_subscription` refuses a row carrying `cancel_at_period_end`, so the
	// staff matrix must not offer a button that can only 400.
	it('withdraws pause on an active sub scheduled to cancel', () => {
		for (const pm of ['online', 'offline'] as const) {
			const actions = getAvailableActions(
				makeSub({ status: 'active', payment_method: pm, cancel_at_period_end: true })
			);
			expect(actions.pause).toBe(false);
		}
	});

	it('leaves the other actions on that row untouched, and offers the way back', () => {
		expect(
			getAvailableActions(
				makeSub({ status: 'active', payment_method: 'offline', cancel_at_period_end: true })
			)
		).toEqual({
			recordPayment: true,
			pause: false,
			resume: false,
			cancel: true,
			revive: false,
			uncancel: true
		});
	});

	it('still offers pause when renewal is on', () => {
		expect(
			getAvailableActions(makeSub({ status: 'active', cancel_at_period_end: false })).pause
		).toBe(true);
	});

	it('is a no-op on statuses that never offered pause', () => {
		const paused = getAvailableActions(makeSub({ status: 'paused', cancel_at_period_end: true }));
		expect(paused).toMatchObject({ pause: false, resume: true, cancel: true });
	});
});

/**
 * The staff `uncancel` gate, straight off `subscription_uncancel.uncancel_subscription`
 * (BE #813 / our #808): non-terminal row + `cancel_at_period_end` + a plan that is
 * still active. Payment method is deliberately absent — the service takes a purely
 * local path for OFFLINE rows and never inspects it.
 */
describe('getAvailableActions uncancel gating', () => {
	it('offers undo on every non-terminal status carrying a scheduled cancellation', () => {
		for (const status of ['pending', 'active', 'past_due', 'paused'] as const) {
			for (const pm of ['online', 'offline'] as const) {
				const actions = getAvailableActions(
					makeSub({ status, payment_method: pm, cancel_at_period_end: true })
				);
				expect(actions.uncancel).toBe(true);
			}
		}
	});

	// The endpoint answers 200-unchanged here, so a button would provably do nothing.
	it('withdraws undo when there is no scheduled cancellation', () => {
		for (const status of ['pending', 'active', 'past_due', 'paused'] as const) {
			expect(getAvailableActions(makeSub({ status, cancel_at_period_end: false })).uncancel).toBe(
				false
			);
		}
	});

	// Terminal rows: 400 from the service ("Cannot resume renewal on a cancelled or
	// expired subscription") — the cancellation already happened.
	it('withdraws undo on terminal rows even with the flag still set', () => {
		for (const status of ['cancelled', 'expired'] as const) {
			expect(getAvailableActions(makeSub({ status, cancel_at_period_end: true })).uncancel).toBe(
				false
			);
		}
	});

	// Archived plan: 400 ("This plan is archived…") — keeping the renewal alive
	// would go on billing a retired plan.
	it('withdraws undo once the plan has been archived', () => {
		const sub = makeSub({ status: 'active', cancel_at_period_end: true });
		sub.plan.is_active = false;
		expect(getAvailableActions(sub).uncancel).toBe(false);
	});

	// Guard 4 on the staff surface: the drawer passes the annotated
	// `SubscriptionSchema.member_status`, so a suspended member row withdraws the
	// undo here exactly as it does on the member card.
	it('withdraws undo when the member row is paused or banned', () => {
		const sub = makeSub({ status: 'active', cancel_at_period_end: true });
		expect(getAvailableActions(sub, 'paused').uncancel).toBe(false);
		expect(getAvailableActions(sub, 'banned').uncancel).toBe(false);
		// Only `uncancel` is on this axis — the rest of the matrix is untouched.
		expect(getAvailableActions(sub, 'paused').cancel).toBe(true);
	});

	// `null` is the backend's "no member row exists", which is *not* "active" —
	// both it and an omitted status mean "cannot pre-gate, let the server decide",
	// so neither may hide the button.
	it('keeps undo for an active, absent or null member status', () => {
		const sub = makeSub({ status: 'active', cancel_at_period_end: true });
		expect(getAvailableActions(sub, 'active').uncancel).toBe(true);
		expect(getAvailableActions(sub, null).uncancel).toBe(true);
		expect(getAvailableActions(sub, undefined).uncancel).toBe(true);
		expect(getAvailableActions(sub).uncancel).toBe(true);
	});
});

describe('canUncancel', () => {
	const live = { status: 'active', cancel_at_period_end: true, plan: { is_active: true } } as const;

	it('is true only for a non-terminal, scheduled-to-cancel row on a live plan', () => {
		expect(canUncancel(live)).toBe(true);
		expect(canUncancel({ ...live, cancel_at_period_end: false })).toBe(false);
		expect(canUncancel({ ...live, status: 'cancelled' })).toBe(false);
		expect(canUncancel({ ...live, status: 'expired' })).toBe(false);
		expect(canUncancel({ ...live, plan: { is_active: false } })).toBe(false);
	});

	// `is_active` is optional in the generated schema (Django default true), so an
	// absent flag must not be read as "archived".
	it('treats an absent is_active as still active', () => {
		expect(canUncancel({ status: 'active', cancel_at_period_end: true, plan: {} })).toBe(true);
	});

	// Likewise optional: an absent flag is "not scheduled", not "unknown".
	it('treats an absent cancel_at_period_end as not scheduled', () => {
		expect(canUncancel({ status: 'active', plan: { is_active: true } })).toBe(false);
	});

	// Guard 4 (`_assert_membership_allows_renewal`): a suspended member row makes
	// the call a guaranteed 403, even though guards 1–3 all wave the row through.
	it('withdraws the undo for a paused or banned membership', () => {
		expect(canUncancel(live, 'paused')).toBe(false);
		expect(canUncancel(live, 'banned')).toBe(false);
	});

	it('leaves the undo alone for an active membership or an unknown one', () => {
		expect(canUncancel(live, 'active')).toBe(true);
		// An omitted status, and `null` (the backend's "no member row exists" — not a
		// synonym for "active"), both mean "cannot pre-gate": let the server decide
		// rather than read either as "suspended".
		expect(canUncancel(live)).toBe(true);
		expect(canUncancel(live, null)).toBe(true);
	});
});

describe('isMembershipSuspended', () => {
	it('is true exactly for the two statuses the backend refuses', () => {
		expect(isMembershipSuspended('paused')).toBe(true);
		expect(isMembershipSuspended('banned')).toBe(true);
		expect(isMembershipSuspended('active')).toBe(false);
		expect(isMembershipSuspended('cancelled')).toBe(false);
		expect(isMembershipSuspended(null)).toBe(false);
		expect(isMembershipSuspended(undefined)).toBe(false);
	});
});

describe('formatPlanPrice', () => {
	it('formats monthly', () => {
		expect(formatPlanPrice(basePlan)).toBe('€10.00 / month');
	});
	it('formats annual', () => {
		expect(formatPlanPrice({ ...basePlan, period_unit: 'year', period_count: 1 })).toBe(
			'€10.00 / year'
		);
	});
	it('formats N-month', () => {
		expect(formatPlanPrice({ ...basePlan, period_count: 3 })).toBe('€10.00 / 3 months');
	});
	it('formats N-year', () => {
		expect(formatPlanPrice({ ...basePlan, period_unit: 'year', period_count: 2 })).toBe(
			'€10.00 / 2 years'
		);
	});

	// "€0.00 / month" is wrong twice over on a free plan: it quotes a charge that
	// never happens, on a cadence that never comes round.
	it('says "Free" for a free plan instead of quoting a zero amount', () => {
		expect(
			formatPlanPrice({
				...basePlan,
				payment_method: 'free',
				price: '0.00',
				period_unit: 'lifetime'
			})
		).toBe('Free');
	});

	// A LIFETIME term never renews, so there is no "/ month" to append — an
	// offline one-off membership still has a real price to state.
	it('quotes a lifetime plan as a one-time amount, with no cadence', () => {
		expect(
			formatPlanPrice({ ...basePlan, price: '50.00', period_unit: 'lifetime', period_count: 1 })
		).toBe('€50.00 · one-time');
	});

	// The FREE branch is decided by the payment method, not by the amount: a
	// zero-priced OFFLINE plan is a staff-assigned comp, not a self-serve one.
	it('does not call a zero-priced offline plan free', () => {
		expect(formatPlanPrice({ ...basePlan, price: '0.00' })).toBe('€0.00 / month');
	});
});

describe('isFreePlan / isLifetimePlan', () => {
	it('recognises only the free payment method', () => {
		expect(isFreePlan({ payment_method: 'free' })).toBe(true);
		expect(isFreePlan({ payment_method: 'offline' })).toBe(false);
		expect(isFreePlan({ payment_method: 'online' })).toBe(false);
		expect(isFreePlan({})).toBe(false);
	});

	it('recognises only the lifetime period unit', () => {
		expect(isLifetimePlan({ period_unit: 'lifetime' })).toBe(true);
		expect(isLifetimePlan({ period_unit: 'month' })).toBe(false);
		expect(isLifetimePlan({ period_unit: 'year' })).toBe(false);
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
		const line = getDateLine(makeSub({ status: 'active' }));
		expect(line.kind).toBe('renewal');
	});
	it('active + cancel_at_period_end → "Cancels on …"', () => {
		const line = getDateLine(makeSub({ status: 'active', cancel_at_period_end: true }));
		expect(line.kind).toBe('cancels');
	});
	it('past_due → "Period ends …"', () => {
		const line = getDateLine(makeSub({ status: 'past_due' }));
		expect(line.kind).toBe('period_ends');
	});
	it('paused → "Paused since …"', () => {
		const line = getDateLine(makeSub({ status: 'paused' }));
		expect(line.kind).toBe('paused_since');
	});
	it('cancelled → "Ended …"', () => {
		const line = getDateLine(
			makeSub({ status: 'cancelled', cancelled_at: '2026-05-01T00:00:00Z' })
		);
		expect(line.kind).toBe('ended');
	});
	it('expired → "Ended …"', () => {
		expect(getDateLine(makeSub({ status: 'expired' })).kind).toBe('ended');
	});
	it('pending → kind: pending', () => {
		expect(getDateLine(makeSub({ status: 'pending' })).kind).toBe('pending');
	});
});

function mySub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		plan_id: 'p1',
		organization_id: 'o1',
		status: 'active',
		current_period_start: '2026-07-01T00:00:00Z',
		current_period_end: '2026-08-01T00:00:00Z',
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: null,
		revival_deadline: null,
		id: 's1',
		cancel_at_period_end: false,
		created_at: '2026-07-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
		plan: {
			id: 'p1',
			tier_id: 't1',
			tier_name: 'Gold',
			name: 'Monthly',
			description: null,
			price: '10.00',
			currency: 'EUR',
			period_unit: 'month',
			period_count: 1,
			is_active: true,
			payment_method: 'online',
			sales_status: 'open'
		},
		organization_name: 'Org',
		organization_slug: 'org',
		organization_logo_url: null,
		...overrides
	};
}

const NOW = new Date('2026-07-26T12:00:00Z');

describe('getMemberActions', () => {
	it('offline subscriptions get no self-serve actions regardless of status', () => {
		for (const status of ['active', 'past_due', 'expired', 'pending'] as const) {
			const sub = mySub({ status });
			sub.plan.payment_method = 'offline';
			expect(getMemberActions(sub, NOW)).toEqual({
				manageBilling: false,
				changePlan: false,
				cancel: false,
				revive: false,
				resumePayment: false,
				uncancel: false
			});
		}
	});

	it('online active offers billing, change plan and cancel', () => {
		expect(getMemberActions(mySub(), NOW)).toEqual({
			manageBilling: true,
			changePlan: true,
			cancel: true,
			revive: false,
			resumePayment: false,
			uncancel: false
		});
	});

	/**
	 * Regression fence, not a style preference: `me_subscriptions.change_plan`
	 * 400s an OFFLINE row in the controller ("managed by the organization"),
	 * because an offline swap is immediate and fee-free and the next
	 * staff-recorded payment derives its period from the plan the row is on — a
	 * self-service Monthly→Annual switch would buy twelve months for one monthly
	 * payment. Never offer the button, on any status.
	 */
	it.each(['active', 'past_due', 'paused', 'pending', 'expired', 'cancelled'] as const)(
		'never offers change-plan on an offline %s row (BE refuses it in the controller)',
		(status) => {
			const sub = mySub({ status });
			sub.plan.payment_method = 'offline';
			expect(getMemberActions(sub, NOW).changePlan).toBe(false);
		}
	);

	/**
	 * Regression fence: `_validate_change_plan_state` 400s PAST_DUE. An upgrade
	 * invoices only the proration delta, and settling that invoice revives the row
	 * to ACTIVE while the lapsed renewal invoice stays unpaid — a false ACTIVE on
	 * the pricier tier with the dunning warning cleared. The portal is the way out.
	 */
	it.each([false, true])(
		'never offers change-plan on a past_due row (cancel_at_period_end=%s) — false-ACTIVE proration trap',
		(cancelAtPeriodEnd) => {
			const actions = getMemberActions(
				mySub({ status: 'past_due', cancel_at_period_end: cancelAtPeriodEnd }),
				NOW
			);
			expect(actions.changePlan).toBe(false);
			// The remediation the BE documents stays reachable.
			expect(actions.manageBilling).toBe(true);
		}
	);

	// BE preflight rejects change-plan while a change is already pending.
	it('online active with a pending plan change hides change plan only', () => {
		expect(getMemberActions(mySub({ pending_plan_id: 'p2' }), NOW).changePlan).toBe(false);
		expect(getMemberActions(mySub({ pending_plan_id: 'p2' }), NOW).cancel).toBe(true);
	});

	// BE preflight rejects change-plan AND cancel is redundant once renewal is off —
	// but the row is no longer a dead end: #808 added the way back.
	it('online active scheduled to cancel offers manage billing and the undo', () => {
		expect(getMemberActions(mySub({ cancel_at_period_end: true }), NOW)).toEqual({
			manageBilling: true,
			changePlan: false,
			cancel: false,
			revive: false,
			resumePayment: false,
			uncancel: true
		});
	});

	// The member endpoint would accept it (the service never looks at the payment
	// method), but an OFFLINE cancellation was scheduled by staff — undoing it is
	// theirs to do, from the admin drawer.
	it('offline active scheduled to cancel still offers nothing self-serve', () => {
		const sub = mySub({ cancel_at_period_end: true });
		sub.plan.payment_method = 'offline';
		expect(getMemberActions(sub, NOW).uncancel).toBe(false);
	});

	// Archived plan → the BE refuses with 400, so no button.
	it('online active scheduled to cancel on an archived plan offers no undo', () => {
		const sub = mySub({ cancel_at_period_end: true });
		sub.plan.is_active = false;
		expect(getMemberActions(sub, NOW)).toEqual({
			manageBilling: true,
			changePlan: false,
			cancel: false,
			revive: false,
			resumePayment: false,
			uncancel: false
		});
	});

	it('online past_due offers billing portal and cancel', () => {
		expect(getMemberActions(mySub({ status: 'past_due' }), NOW)).toEqual({
			manageBilling: true,
			changePlan: false,
			cancel: true,
			revive: false,
			resumePayment: false,
			uncancel: false
		});
	});

	// Same shape as ACTIVE: renewal is already off, so cancelling again says nothing
	// new and undoing it is the action that does.
	it('online past_due scheduled to cancel swaps cancel for the undo', () => {
		expect(
			getMemberActions(mySub({ status: 'past_due', cancel_at_period_end: true }), NOW)
		).toEqual({
			manageBilling: true,
			changePlan: false,
			cancel: false,
			revive: false,
			resumePayment: false,
			uncancel: true
		});
	});

	it('online expired inside the revival window offers revive only', () => {
		const sub = mySub({
			status: 'expired',
			expired_at: '2026-07-20T00:00:00Z',
			revival_deadline: '2026-08-19T00:00:00Z'
		});
		expect(getMemberActions(sub, NOW)).toEqual({
			manageBilling: false,
			changePlan: false,
			cancel: false,
			revive: true,
			resumePayment: false,
			uncancel: false
		});
	});

	it('online expired past the deadline (or with none) offers nothing', () => {
		const past = mySub({ status: 'expired', revival_deadline: '2026-07-25T00:00:00Z' });
		const none = mySub({ status: 'expired', revival_deadline: null });
		const nothing = {
			manageBilling: false,
			changePlan: false,
			cancel: false,
			revive: false,
			resumePayment: false,
			uncancel: false
		};
		expect(getMemberActions(past, NOW)).toEqual(nothing);
		expect(getMemberActions(none, NOW)).toEqual(nothing);
	});

	/**
	 * #694: an abandoned Checkout (subscribe- or revival-origin) leaves the row
	 * PENDING with a still-open session; re-POSTing subscribe with the same plan
	 * hands that session back (`_maybe_resume_pending_checkout`). Without this
	 * the card is a dead end.
	 */
	it('online pending offers resume payment only', () => {
		expect(getMemberActions(mySub({ status: 'pending' }), NOW)).toEqual({
			manageBilling: false,
			changePlan: false,
			cancel: false,
			revive: false,
			resumePayment: true,
			uncancel: false
		});
	});

	// OFFLINE pending is awaiting a staff-recorded payment — there is no Checkout
	// session for the member to resume.
	it('offline pending offers nothing', () => {
		const sub = mySub({ status: 'pending' });
		sub.plan.payment_method = 'offline';
		expect(getMemberActions(sub, NOW).resumePayment).toBe(false);
	});

	it('paused and cancelled offer nothing', () => {
		for (const status of ['paused', 'cancelled'] as const) {
			expect(getMemberActions(mySub({ status }), NOW)).toEqual({
				manageBilling: false,
				changePlan: false,
				cancel: false,
				revive: false,
				resumePayment: false,
				uncancel: false
			});
		}
	});

	// Pause is admin-only, so a PAUSED row's scheduled cancellation is staff's to
	// undo too — the member surface stays silent on it.
	it('paused with a scheduled cancellation still offers no member undo', () => {
		expect(
			getMemberActions(mySub({ status: 'paused', cancel_at_period_end: true }), NOW).uncancel
		).toBe(false);
	});

	/**
	 * The reachable 403: `_mirror_status_to_subscriptions` skips a subscription
	 * that is already scheduled to cancel, so a staff PAUSE leaves the member row
	 * PAUSED while the subscription stays ACTIVE/PAST_DUE — guards 1–3 all pass and
	 * `_assert_membership_allows_renewal` refuses.
	 */
	it.each(['active', 'past_due'] as const)(
		'withdraws the undo on a %s row when the membership is suspended',
		(status) => {
			const sub = mySub({ status, cancel_at_period_end: true });
			expect(getMemberActions(sub, NOW, 'paused').uncancel).toBe(false);
			expect(getMemberActions(sub, NOW, 'banned').uncancel).toBe(false);
			// The portal is untouched: it is not what the backend refuses.
			expect(getMemberActions(sub, NOW, 'paused').manageBilling).toBe(true);
			// …and an unsuspended membership keeps the way back.
			expect(getMemberActions(sub, NOW, 'active').uncancel).toBe(true);
			expect(getMemberActions(sub, NOW).uncancel).toBe(true);
		}
	);

	// Suspension only ever narrows `uncancel`; nothing else on the matrix moves.
	it('leaves an unscheduled active row untouched for a suspended membership', () => {
		expect(getMemberActions(mySub(), NOW, 'paused')).toEqual({
			manageBilling: true,
			changePlan: true,
			cancel: true,
			revive: false,
			resumePayment: false,
			uncancel: false
		});
	});
});

describe('needsMembershipSuspendedNotice', () => {
	it('speaks up when the member row is suspended but the subscription is not', () => {
		expect(needsMembershipSuspendedNotice(mySub({ status: 'active' }), 'paused')).toBe(true);
		expect(needsMembershipSuspendedNotice(mySub({ status: 'past_due' }), 'banned')).toBe(true);
		expect(needsMembershipSuspendedNotice(mySub({ status: 'pending' }), 'paused')).toBe(true);
	});

	it('stays quiet for an unsuspended or unknown membership', () => {
		expect(needsMembershipSuspendedNotice(mySub({ status: 'active' }), 'active')).toBe(false);
		expect(needsMembershipSuspendedNotice(mySub({ status: 'active' }))).toBe(false);
		expect(needsMembershipSuspendedNotice(mySub({ status: 'active' }), null)).toBe(false);
	});

	// `pausedHint` already says it — two notices saying the same thing is noise.
	it('defers to the paused-subscription hint when the subscription mirrors the pause', () => {
		expect(needsMembershipSuspendedNotice(mySub({ status: 'paused' }), 'paused')).toBe(false);
	});

	// Nothing left to restore, and a ban terminalizes the subscription anyway
	// (`cancel_subscriptions_for_membership_loss`).
	it.each(['cancelled', 'expired'] as const)('stays quiet on a %s subscription', (status) => {
		expect(needsMembershipSuspendedNotice(mySub({ status }), 'banned')).toBe(false);
	});

	it('stays quiet on a membership with no subscription at all', () => {
		expect(needsMembershipSuspendedNotice(null, 'paused')).toBe(false);
		expect(needsMembershipSuspendedNotice(undefined, 'paused')).toBe(false);
	});
});

describe('isWithinRevivalWindow', () => {
	it('is true strictly before the deadline, false at or after it', () => {
		const sub = { status: 'expired', revival_deadline: '2026-08-19T00:00:00Z' } as const;
		expect(isWithinRevivalWindow(sub, new Date('2026-08-18T23:59:59Z'))).toBe(true);
		expect(isWithinRevivalWindow(sub, new Date('2026-08-19T00:00:00Z'))).toBe(false);
	});

	it('is false for non-expired statuses and missing deadlines', () => {
		expect(
			isWithinRevivalWindow({ status: 'active', revival_deadline: '2099-01-01T00:00:00Z' }, NOW)
		).toBe(false);
		expect(isWithinRevivalWindow({ status: 'expired', revival_deadline: null }, NOW)).toBe(false);
	});
});

describe('classifyPlanChange (mirrors BE monthly-equivalent rule)', () => {
	const monthly10 = { price: '10.00', period_unit: 'month', period_count: 1 } as const;
	const yearly96 = { price: '96.00', period_unit: 'year', period_count: 1 } as const; // 8/mo
	const yearly150 = { price: '150.00', period_unit: 'year', period_count: 1 } as const; // 12.5/mo
	const biennial240 = { price: '240.00', period_unit: 'year', period_count: 2 } as const; // 10/mo
	const quarterly36 = { price: '36.00', period_unit: 'month', period_count: 3 } as const; // 12/mo

	it('normalizes cadence to per-month before comparing', () => {
		expect(monthlyEquivalent(yearly96)).toBeCloseTo(8);
		expect(classifyPlanChange(monthly10, yearly96)).toBe('downgrade'); // cheaper per month despite bigger headline
		expect(classifyPlanChange(monthly10, yearly150)).toBe('upgrade');
	});

	// period_count is a real multiplier, not decoration: drop it and a 2-year plan
	// reads as 20/mo instead of 10/mo, and a 3-month plan as 36/mo instead of 12/mo.
	it('divides by period_count as well as the unit', () => {
		expect(monthlyEquivalent(biennial240)).toBeCloseTo(10); // 240 / (12 * 2)
		expect(monthlyEquivalent(quarterly36)).toBeCloseTo(12); // 36 / (1 * 3)
		expect(classifyPlanChange(monthly10, biennial240)).toBe('downgrade'); // tie at 10/mo
		expect(classifyPlanChange(monthly10, quarterly36)).toBe('upgrade');
		expect(classifyPlanChange(quarterly36, biennial240)).toBe('downgrade');
	});

	it('defaults a missing period_count to 1', () => {
		expect(monthlyEquivalent({ price: '10.00', period_unit: 'month' })).toBeCloseTo(10);
	});

	it('a tie is a downgrade (strictly-greater is BE semantics)', () => {
		expect(
			classifyPlanChange(monthly10, { price: '120.00', period_unit: 'year', period_count: 1 })
		).toBe('downgrade');
	});
});
