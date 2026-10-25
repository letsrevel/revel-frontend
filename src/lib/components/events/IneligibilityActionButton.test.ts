/**
 * Invitation-claim loop regression (PR #1115). The claim button must only
 * stand in for the CTA while the invitation gate is what blocks the user.
 * The backend evaluates InvitationGate before FullProfileGate, the
 * questionnaire gate and availability, so any later `next_step` means the
 * invitation is already held: offering the claim again succeeds, reloads
 * with the pending_event_token cookie still set, and shows the claim button
 * again instead of the step that really blocks.
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
		['wait_for_invitation_approval', 'wait_for_invitation_approval']
	])('offers the claim button for a granting token with %s', (_label, nextStep) => {
		setup(nextStep, token);
		expect(screen.getByRole('button', { name: claimName() })).toBeInTheDocument();
	});

	it.each<NextStep>([
		'complete_profile',
		'complete_questionnaire',
		'purchase_ticket',
		'rsvp',
		'become_member',
		'join_waitlist'
	])('does not offer the claim button for a granting token with %s', (nextStep) => {
		setup(nextStep, token);
		expect(screen.queryByRole('button', { name: claimName() })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: getActionButtonText(nextStep) })).toBeInTheDocument();
	});

	it('shows the Complete Profile CTA, not the claim button, once the invitation is held', () => {
		setup('complete_profile', token);
		expect(screen.getByRole('button', { name: 'Complete Profile' })).toBeEnabled();
		expect(screen.queryByRole('button', { name: claimName() })).not.toBeInTheDocument();
	});

	it('never offers the claim button when the token grants no invitation', () => {
		setup(null, { ...token, grants_invitation: false });
		expect(screen.queryByRole('button', { name: claimName() })).not.toBeInTheDocument();
	});

	it('never offers the claim button without token details', () => {
		setup('request_invitation', null);
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
		setup('complete_profile', token);

		await user.click(screen.getByRole('button', { name: 'Complete Profile' }));

		expect(assigned).toBe(`/account/profile?redirect=${encodeURIComponent('/events/acme/gala')}`);
	});
});
