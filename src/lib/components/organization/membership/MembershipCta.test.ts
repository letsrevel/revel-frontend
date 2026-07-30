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
import * as m from '$lib/paraglide/messages.js';

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

// hey-api resolves rather than throws, so a failure is an error payload — the
// same shape the queryFn turns into a rejection.
function mockEligibilityFailure() {
	vi.mocked(memembershipapplicationsGetJoinEligibility).mockResolvedValue({
		data: undefined,
		error: { detail: 'boom' },
		response: { ok: false, status: 500 } as unknown as Response
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

	/**
	 * The tier-grid usage (#720): the CTA asks about ONE tier and can act on it.
	 * Summary mode — `renderCta` above, no `tierId` — deliberately cannot: applying
	 * without a tier is the tier-less application this issue exists to remove, so
	 * there every actionable verdict becomes a link to the tier page instead.
	 */
	function renderTierCta(props: Record<string, unknown> = {}) {
		return renderCta({ tierId: 'tier-gold', tierName: 'Gold', ...props });
	}

	it('offers a tier-named join button when the verdict allows joining', async () => {
		mockEligibility(makeEligibility({ allowed: true }));
		renderTierCta();

		// Named with the tier, not a bare "Join": a screen-reader user hears these
		// out of context, and N identical buttons would be indistinguishable.
		expect(await screen.findByRole('button', { name: 'Join Gold' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /join acme/i })).toBeNull();
	});

	it('asks the backend about that specific tier', async () => {
		mockEligibility(makeEligibility({ allowed: true }));
		renderTierCta();

		await screen.findByRole('button', { name: 'Join Gold' });
		expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).toHaveBeenCalledWith(
			expect.objectContaining({ query: { tier_id: 'tier-gold' } })
		);
	});

	// Summary mode has no tier to apply to, so an allowed verdict is not a Join
	// button — it is the pointer at the page where a tier can be chosen.
	it('links to the tier page instead of applying when it has no tier', async () => {
		mockEligibility(makeEligibility({ allowed: true }));
		renderCta();

		const link = await screen.findByRole('link', {
			name: m['membershipPlans.viewMembership']()
		});
		expect(link).toHaveAttribute('href', '/org/acme/membership');
		expect(screen.queryByRole('button', { name: /join/i })).toBeNull();
	});

	// BE #831: a tier can be gated AND paid, and this step is the positive end of
	// that chain — the gates are satisfied and only the charge is left.
	it('points at the plans on screen for a proceed_to_payment verdict', async () => {
		mockEligibility(makeEligibility({ allowed: false, next_step: 'proceed_to_payment' }));
		renderTierCta({ plansInline: true });

		expect(await screen.findByRole('note')).toHaveTextContent(
			m['membershipEligibility.choosePlan']()
		);
		expect(screen.queryByRole('button', { name: /join/i })).toBeNull();
	});

	it('links to the tier page for proceed_to_payment when the plans are elsewhere', async () => {
		mockEligibility(makeEligibility({ allowed: false, next_step: 'proceed_to_payment' }));
		renderCta();

		expect(
			await screen.findByRole('link', { name: m['membershipPlans.viewMembership']() })
		).toHaveAttribute('href', '/org/acme/membership');
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
				application_id: 'app-1',
				reason: 'Membership requests are approved by the organization.'
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
		renderTierCta();

		expect(await screen.findByRole('button', { name: 'Join Gold' })).toBeInTheDocument();
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

	// BE #812, the exact verdict `MembershipQuestionnaireGate._handle_rejected`
	// emits at the attempts cap: refused, no next_step, `questionnaire_id` still
	// attached. That last field is the trap — before the dedicated code this same
	// member got `submit_questionnaire` and a live link into a questionnaire whose
	// submit endpoint would 400 them. Nothing here may be clickable.
	it('states the attempts cap and offers no way back into the questionnaire', async () => {
		mockEligibility(
			makeEligibility({
				allowed: false,
				next_step: null,
				reason_code: 'membership_questionnaire_attempts_exhausted',
				questionnaire_id: 'q1',
				reason: 'You have reached the maximum number of attempts.'
			})
		);
		const { container } = renderCta();

		expect(await screen.findByRole('note')).toHaveTextContent(/all your attempts/i);
		// Not just "no join button": no actionable control of any kind. The
		// questionnaire CTA is a link, so a role-scoped assertion would miss it.
		expect(container.querySelectorAll('button')).toHaveLength(0);
		expect(container.querySelectorAll('a')).toHaveLength(0);
		expect(screen.queryByRole('button', { name: /join acme/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /re-apply/i })).toBeNull();
	});

	// The terminal note replaces the skeleton in the same slot, and the error
	// branch sits in a sibling live region — a verdict that resolves must not
	// leave either of them on screen.
	it('composes with the loading and error branches', async () => {
		mockEligibility(
			makeEligibility({
				allowed: false,
				reason_code: 'membership_questionnaire_attempts_exhausted'
			})
		);
		const { container } = renderCta();

		await screen.findByRole('note');
		expect(container.querySelector('.animate-pulse')).toBeNull();
		expect(screen.queryByText(/couldn't load your join options/i)).toBeNull();
	});

	// The return URL is the tier grid, not the org landing page: the round trip
	// exists so the visitor can press Join on a tier, so it has to come back to
	// where that button is.
	it('sends a guest on a tier card to login and back to the tier grid', () => {
		renderTierCta({ isAuthenticated: false });

		const link = screen.getByRole('link', { name: 'Join Gold' });
		expect(link).toHaveAttribute('href', '/login?returnUrl=%2Forg%2Facme%2Fmembership');
		expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalled();
	});

	// The grid is public, so a guest gets to see what they would be joining before
	// being asked for an account.
	it('sends a guest on the org page to the tier grid rather than to login', () => {
		renderCta({ isAuthenticated: false });

		const link = screen.getByRole('link', { name: /join acme/i });
		expect(link).toHaveAttribute('href', '/org/acme/membership');
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

	// The CTA slot must never be an empty hole: `queryEnabled` needs a token, which
	// is absent through SSR and the client auth bootstrap, so "in flight" is the
	// state an authenticated first paint actually starts in.
	it('holds the slot with a decorative placeholder while the verdict is still loading', () => {
		vi.mocked(memembershipapplicationsGetJoinEligibility).mockReturnValue(
			new Promise(() => {
				/* never settles: the verdict stays in flight */
			}) as unknown as ReturnType<typeof memembershipapplicationsGetJoinEligibility>
		);
		const { container } = renderCta();

		const placeholder = container.querySelector('.animate-pulse');
		expect(placeholder).not.toBeNull();
		// Decorative only — it must not be announced as content.
		expect(placeholder).toHaveAttribute('aria-hidden', 'true');
		// Still nothing actionable: the verdict has not decided anything yet.
		expect(container.querySelector('button')).toBeNull();
		expect(container.querySelector('a')).toBeNull();
	});

	// `retry: false` means a failed verdict never self-heals; without a visible
	// error the join CTA would just be gone.
	it('explains a failed verdict instead of dropping the CTA silently', async () => {
		mockEligibilityFailure();
		renderCta();

		expect(await screen.findByText(/couldn't load your join options/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
	});

	// The message has to reach a screen reader: it replaces the placeholder without
	// moving focus, so it must sit in a live region that already existed while the
	// verdict was in flight — a region injected together with its first message is
	// not observed by assistive tech and stays silent.
	it('announces the failure from a live region that was mounted before it spoke', async () => {
		mockEligibilityFailure();
		const { container } = renderCta();

		// Present from first paint, before there is anything to announce.
		expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();

		const message = await screen.findByText(/couldn't load your join options/i);
		expect(message.closest('[aria-live="polite"]')).not.toBeNull();
	});

	it('recovers the join button when the retry succeeds', async () => {
		const user = userEvent.setup();
		mockEligibilityFailure();
		renderTierCta();

		const retry = await screen.findByRole('button', { name: /try again/i });
		expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).toHaveBeenCalledTimes(1);

		mockEligibility(makeEligibility({ allowed: true }));
		await user.click(retry);

		expect(await screen.findByRole('button', { name: 'Join Gold' })).toBeInTheDocument();
		expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).toHaveBeenCalledTimes(2);
		expect(screen.queryByText(/couldn't load your join options/i)).toBeNull();
	});

	it('opens the apply dialog from the join button', async () => {
		const user = userEvent.setup();
		mockEligibility(makeEligibility({ allowed: true }));
		renderTierCta();

		await user.click(await screen.findByRole('button', { name: 'Join Gold' }));

		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveTextContent('Join Gold');
		expect(vi.mocked(memembershipapplicationsApply)).not.toHaveBeenCalled();
	});

	// A completed application calls `invalidateAll()`; the reloaded page comes
	// back with `isMember` true. The dialog is still showing the outcome, so it
	// must survive the CTA switching to the member badge behind it.
	it('keeps the open apply dialog mounted when the CTA flips to the member badge', async () => {
		const user = userEvent.setup();
		mockEligibility(makeEligibility({ allowed: true }));
		const { rerender } = renderTierCta();

		await user.click(await screen.findByRole('button', { name: 'Join Gold' }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Join Gold');

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
					tierId: 'tier-gold',
					tierName: 'Gold',
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
		expect(screen.getAllByText('Gold').length).toBeGreaterThan(0);
		expect(screen.getByRole('dialog')).toHaveTextContent('Join Gold');
	});

	it('opens the apply dialog in re-apply mode when a past application ended', async () => {
		const user = userEvent.setup();
		mockEligibility(makeEligibility({ allowed: false, next_step: 'reapply' }));
		renderTierCta();

		await user.click(await screen.findByRole('button', { name: /re-apply/i }));

		expect(await screen.findByRole('dialog')).toHaveTextContent('Re-apply to Gold');
	});

	// The cache key carries the tier (#720). Without it the first card's verdict
	// would be served to every other tier on the page — one tier's "you can join"
	// answering for a tier that wants a questionnaire.
	it('keeps per-tier verdicts apart in the cache', async () => {
		vi.mocked(memembershipapplicationsGetJoinEligibility).mockImplementation((async (options: {
			query?: { tier_id?: string };
		}) => ({
			data:
				options.query?.tier_id === 'tier-gold'
					? makeEligibility({ allowed: true })
					: makeEligibility({
							allowed: false,
							next_step: 'submit_questionnaire',
							questionnaire_id: 'q1'
						}),
			error: undefined,
			response: { ok: true } as unknown as Response
		})) as unknown as typeof memembershipapplicationsGetJoinEligibility);

		renderTierCta();
		renderCta({ tierId: 'tier-silver', tierName: 'Silver' });

		expect(await screen.findByRole('button', { name: 'Join Gold' })).toBeInTheDocument();
		expect(
			await screen.findByRole('link', { name: m['membershipEligibility.questionnaireCta']() })
		).toHaveAttribute('href', '/org/acme/questionnaire/q1');
	});
});
