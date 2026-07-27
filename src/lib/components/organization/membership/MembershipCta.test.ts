import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import MembershipCta from './MembershipCta.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	memembershipapplicationsApply,
	memembershipapplicationsGetJoinEligibility
} from '$lib/api/generated/sdk.gen';
import type { MembershipEligibilitySchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	memembershipapplicationsGetJoinEligibility: vi.fn(),
	memembershipapplicationsApply: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

// ApplyDialog (rendered by the CTA) invalidates the page data on success.
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

function makeEligibility(
	overrides: Partial<MembershipEligibilitySchema> = {}
): MembershipEligibilitySchema {
	return {
		allowed: true,
		organization_id: 'org-1',
		tier_id: null,
		plan_id: null,
		reason: null,
		reason_code: null,
		next_step: null,
		questionnaire_id: null,
		application_id: null,
		retry_on: null,
		...overrides
	};
}

function mockEligibility(eligibility: MembershipEligibilitySchema) {
	vi.mocked(memembershipapplicationsGetJoinEligibility).mockResolvedValue({
		data: eligibility,
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof memembershipapplicationsGetJoinEligibility>>);
}

describe('MembershipCta', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		// bits-ui's scroll lock restores `document.body` on a ~24ms timer after a
		// dialog unmounts, so a dialog opened by the previous test can still be
		// blocking pointer events on this one's buttons.
		document.body.style.pointerEvents = '';
	});

	function renderCta(props: Record<string, unknown> = {}) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: MembershipCta,
				componentProps: {
					organizationSlug: 'acme',
					organizationName: 'Acme',
					isAuthenticated: true,
					...props
				}
			}
		});
	}

	it('offers a join button when the verdict allows joining', async () => {
		mockEligibility(makeEligibility({ allowed: true }));
		renderCta();

		expect(await screen.findByRole('button', { name: /join acme/i })).toBeInTheDocument();
	});

	it('links to the membership questionnaire when one must be submitted first', async () => {
		mockEligibility(
			makeEligibility({
				allowed: false,
				next_step: 'submit_questionnaire',
				questionnaire_id: 'q1',
				reason_code: 'membership_questionnaire_missing'
			})
		);
		renderCta();

		const link = await screen.findByRole('link', { name: /membership questionnaire/i });
		expect(link).toHaveAttribute('href', '/org/acme/questionnaire/q1');
	});

	it('shows a disabled pending state and a way to track the application while waiting', async () => {
		mockEligibility(
			makeEligibility({
				allowed: false,
				next_step: 'wait_for_approval',
				reason_code: 'requires_approval'
			})
		);
		renderCta();

		expect(await screen.findByRole('button', { name: /application pending/i })).toBeDisabled();
		expect(screen.getByRole('link', { name: /track your application/i })).toHaveAttribute(
			'href',
			'/account/memberships'
		);
	});

	// Since BE #786-788 a pending tier-less application comes back allowed with an
	// explicit wait_for_approval. Keying the CTA off `allowed` alone would put a
	// Join button here while /account/memberships shows the same application under
	// review — the contradiction smoke item 12 caught.
	it('shows the pending state for an allowed verdict that is waiting for approval', async () => {
		mockEligibility(
			makeEligibility({
				allowed: true,
				next_step: 'wait_for_approval',
				reason_code: 'requires_approval',
				application_id: 'app-1'
			})
		);
		renderCta();

		expect(await screen.findByRole('button', { name: /application pending/i })).toBeDisabled();
		expect(screen.getByRole('link', { name: /track your application/i })).toHaveAttribute(
			'href',
			'/account/memberships'
		);
		expect(screen.queryByRole('button', { name: /join acme/i })).not.toBeInTheDocument();
	});

	// The mirror shape: approval-gated org, no application on file. `requires_approval`
	// is policy context here, not a blocker — the user must still be able to apply.
	it('still offers join when approval is required but no application exists yet', async () => {
		mockEligibility(makeEligibility({ allowed: true, reason_code: 'requires_approval' }));
		renderCta();

		expect(await screen.findByRole('button', { name: /join acme/i })).toBeInTheDocument();
	});

	it('counts down to the retake date when the questionnaire is on cooldown', async () => {
		mockEligibility(
			makeEligibility({
				allowed: false,
				next_step: 'wait_to_retake_questionnaire',
				reason_code: 'membership_questionnaire_retake_cooldown',
				retry_on: '2026-09-01T10:00:00Z'
			})
		);
		renderCta();

		expect(await screen.findByRole('button', { name: /membership questionnaire/i })).toBeDisabled();
		expect(screen.getByText(/available/i)).toBeInTheDocument();
	});

	it('explains a non-actionable verdict in a note instead of offering a button', async () => {
		mockEligibility(
			makeEligibility({ allowed: false, reason_code: 'membership_paused', next_step: null })
		);
		renderCta();

		expect(await screen.findByRole('note')).toHaveTextContent(
			/your membership is currently paused/i
		);
		expect(screen.queryByRole('button', { name: /join acme/i })).toBeNull();
	});

	it('sends a guest to the login page with a return URL back to the org', () => {
		renderCta({ isAuthenticated: false });

		const link = screen.getByRole('link', { name: /join acme/i });
		expect(link).toHaveAttribute('href', '/login?returnUrl=%2Forg%2Facme');
		expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalled();
	});

	it('shows the owner badge without ever asking for eligibility', async () => {
		renderCta({ isOwner: true });

		expect(screen.getByRole('status')).toHaveTextContent(/owner/i);
		// Give the query a tick to fire if the guard were missing.
		await waitFor(() => {
			expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalled();
		});
		expect(screen.queryByRole('button', { name: /join acme/i })).toBeNull();
	});

	it('shows the staff badge without asking for eligibility', () => {
		renderCta({ isStaff: true });

		expect(screen.getByRole('status')).toHaveTextContent(/staff/i);
		expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalled();
	});

	it('shows the member badge with status and tier from the server props', () => {
		renderCta({
			isMember: true,
			membershipStatus: 'active',
			membershipTier: { id: 'tier-1', name: 'Gold' }
		});

		const badge = screen.getByRole('status');
		expect(badge).toHaveTextContent('Active');
		expect(badge).toHaveTextContent('Gold');
		expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalled();
	});

	// The eligibility verdict can say "already a member" when the server props
	// were rendered before the membership existed; the badge must degrade to the
	// plain "Member" pill rather than crash on the missing tier.
	it('falls back to a plain member badge when eligibility reports membership', async () => {
		mockEligibility(makeEligibility({ allowed: true, next_step: 'already_member' }));
		renderCta();

		expect(await screen.findByRole('status')).toHaveTextContent(/member/i);
	});

	it('renders nothing while the verdict is still loading', () => {
		vi.mocked(memembershipapplicationsGetJoinEligibility).mockReturnValue(
			new Promise(() => {
				/* never settles: the verdict stays in flight */
			}) as unknown as ReturnType<typeof memembershipapplicationsGetJoinEligibility>
		);
		const { container } = renderCta();

		expect(container.querySelector('button')).toBeNull();
		expect(container.querySelector('a')).toBeNull();
	});

	it('opens the apply dialog from the join button', async () => {
		const user = userEvent.setup();
		mockEligibility(makeEligibility({ allowed: true }));
		renderCta();

		await user.click(await screen.findByRole('button', { name: /join acme/i }));

		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveTextContent('Join Acme');
		expect(vi.mocked(memembershipapplicationsApply)).not.toHaveBeenCalled();
	});

	// A completed application calls `invalidateAll()`; the reloaded page comes
	// back with `isMember` true. The dialog is still showing the outcome, so it
	// must survive the CTA switching to the member badge behind it.
	it('keeps the open apply dialog mounted when the CTA flips to the member badge', async () => {
		const user = userEvent.setup();
		mockEligibility(makeEligibility({ allowed: true }));
		const { rerender } = renderCta();

		await user.click(await screen.findByRole('button', { name: /join acme/i }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Join Acme');

		// `rerender` treats a top-level `props` key as its legacy call shape and
		// unwraps one level, so the wrapper's own props are nested under it. The
		// resulting deprecation warning is expected, not a signal.
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		await rerender({
			props: {
				client: queryClient,
				component: MembershipCta,
				componentProps: {
					organizationSlug: 'acme',
					organizationName: 'Acme',
					isAuthenticated: true,
					isMember: true,
					membershipStatus: 'active',
					membershipTier: { id: 'tier-1', name: 'Gold' }
				}
			}
		});
		warn.mockRestore();

		// The chain behind the dialog really did switch to the member badge — queried
		// by text, since the open modal aria-hides everything outside itself.
		expect(screen.getByText('Active')).toBeInTheDocument();
		expect(screen.getByText('Gold')).toBeInTheDocument();
		expect(screen.getByRole('dialog')).toHaveTextContent('Join Acme');
	});

	it('opens the apply dialog in re-apply mode when a past application ended', async () => {
		const user = userEvent.setup();
		mockEligibility(makeEligibility({ allowed: false, next_step: 'reapply' }));
		renderCta();

		await user.click(await screen.findByRole('button', { name: /re-apply/i }));

		expect(await screen.findByRole('dialog')).toHaveTextContent('Re-apply to Acme');
	});
});
