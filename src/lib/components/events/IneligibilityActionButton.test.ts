/**
 * Invitation-claim gating (#1115, #1274). A token that grants an invitation
 * always offers the claim first, whatever the next step: its waivers may clear
 * that step (questionnaire, membership, purchase, capacity). The #1115 loop is
 * prevented in ClaimInvitationButton, which deletes the pending_event_token
 * cookie after a successful claim, so the reload carries no token.
 */
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import IneligibilityActionButton from './IneligibilityActionButton.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import * as m from '$lib/paraglide/messages.js';
import { getActionButtonText } from '$lib/utils/eligibility';
import type { EventTokenSchema, NextStep } from '$lib/api/generated/types.gen';

vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('svelte-sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}));

const authState = vi.hoisted(() => ({ accessToken: 'tok' as string | null }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: authState }));

const token: EventTokenSchema = {
	id: 'et-1',
	event_name: 'Gala',
	event_slug: 'gala',
	organization_slug: 'acme',
	event_start: '2030-01-01T20:00:00Z',
	issuer: 'issuer-1',
	event: 'event-1',
	grants_invitation: true,
	created_at: '2029-01-01T00:00:00Z'
};

function setup(nextStep: NextStep | null | undefined, eventTokenDetails: EventTokenSchema | null) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: IneligibilityActionButton,
			componentProps: {
				nextStep,
				eventId: 'event-1',
				eventSlug: 'gala',
				organizationSlug: 'acme',
				eventName: 'Gala',
				eventTokenDetails
			}
		}
	});
}

const claimName = () => m['claimInvitationButton.claimInvitation']();

describe('IneligibilityActionButton claim button gating', () => {
	beforeEach(() => {
		authState.accessToken = 'tok';
	});

	it.each<[string, NextStep | null | undefined]>([
		['no next step', null],
		['an undefined next step', undefined],
		['request_invitation', 'request_invitation'],
		['wait_for_invitation_approval', 'wait_for_invitation_approval'],
		['complete_questionnaire', 'complete_questionnaire'],
		['become_member', 'become_member'],
		['join_waitlist', 'join_waitlist'],
		['purchase_ticket', 'purchase_ticket'],
		['complete_profile', 'complete_profile'],
		['rsvp', 'rsvp']
	])('offers the claim instead of the step for a granting token with %s', (_label, nextStep) => {
		setup(nextStep, token);
		expect(screen.getByRole('button', { name: claimName() })).toBeInTheDocument();
		// Steps that render their own action button: that button is replaced.
		// (The wait steps render only text, and request_invitation shares the claim slot.)
		if (nextStep && !['request_invitation', 'wait_for_invitation_approval'].includes(nextStep)) {
			expect(
				screen.queryByRole('button', { name: getActionButtonText(nextStep) })
			).not.toBeInTheDocument();
		}
	});

	it.each<NextStep>(['complete_questionnaire', 'complete_profile', 'rsvp'])(
		'shows the %s action when the token grants no invitation',
		(nextStep) => {
			setup(nextStep, { ...token, grants_invitation: false });
			expect(screen.queryByRole('button', { name: claimName() })).not.toBeInTheDocument();
			expect(
				screen.getByRole('button', { name: getActionButtonText(nextStep) })
			).toBeInTheDocument();
		}
	);

	it('shows the step action without token details (after a claim cleared the token)', () => {
		setup('complete_questionnaire', null);
		expect(screen.queryByRole('button', { name: claimName() })).not.toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: getActionButtonText('complete_questionnaire') })
		).toBeInTheDocument();
	});

	it('never offers the claim when the token grants no invitation', () => {
		setup(null, { ...token, grants_invitation: false });
		expect(screen.queryByRole('button', { name: claimName() })).not.toBeInTheDocument();
	});

	it('lets an anonymous user with a granting token and no next step log in to claim', () => {
		authState.accessToken = null;
		setup(null, token);
		expect(
			screen.getByRole('button', { name: m['claimInvitationButton.loginToClaim']() })
		).toBeInTheDocument();
	});
});

describe('IneligibilityActionButton complete_profile navigation', () => {
	const originalLocation = window.location;
	let assigned = '';

	beforeEach(() => {
		authState.accessToken = 'tok';
		assigned = '';
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: {
				set href(value: string) {
					assigned = value;
				},
				get href() {
					return assigned;
				}
			}
		});
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
	});

	it('sends the user to the profile page with a redirect back to the event', async () => {
		const user = userEvent.setup();
		setup('complete_profile', null);

		await user.click(
			screen.getByRole('button', { name: m['eligibility.actionButton.complete_profile']() })
		);

		expect(assigned).toBe(`/account/profile?redirect=${encodeURIComponent('/events/acme/gala')}`);
	});

	it('sends become_member to the membership page with the event as returnUrl', async () => {
		const user = userEvent.setup();
		setup('become_member', null);

		await user.click(screen.getByRole('button', { name: getActionButtonText('become_member') }));

		expect(assigned).toBe(
			`/org/acme/membership?returnUrl=${encodeURIComponent('/events/acme/gala')}`
		);
	});
});

describe('IneligibilityActionButton pending membership (BE #1300)', () => {
	beforeEach(() => {
		authState.accessToken = 'tok';
	});

	it.each<[NextStep, () => string, string]>([
		[
			'wait_for_membership_approval',
			() => m['membershipEligibility.trackApplication'](),
			'/account/memberships'
		],
		// No application may exist yet, so the applications list could be empty:
		// the org's membership page shows the per-tier verdict instead.
		[
			'wait_for_membership_questionnaire_evaluation',
			() => m['membershipPlans.viewMembership'](),
			`/org/acme/membership?returnUrl=${encodeURIComponent('/events/acme/gala')}`
		]
	])(
		'renders %s as a disabled waiting state linking to where it is tracked',
		(nextStep, linkName, href) => {
			setup(nextStep, null);
			expect(screen.getByRole('button', { name: getActionButtonText(nextStep) })).toBeDisabled();
			expect(screen.getByRole('link', { name: linkName() })).toHaveAttribute('href', href);
			expect(
				screen.queryByRole('button', { name: getActionButtonText('become_member') })
			).not.toBeInTheDocument();
		}
	);
});
