import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import ApplicationRow from './ApplicationRow.svelte';
import type {
	ApplyResponseSchema,
	MembershipApplicationSchema,
	MembershipEligibilitySchema
} from '$lib/api/generated/types.gen';

const getApplicationMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const applyMock = vi.hoisted(() => vi.fn());
// The factory replaces the whole module, so it must also carry the operations
// the row reaches only transitively (ApplyDialog's `apply`).
vi.mock('$lib/api/generated/sdk.gen', () => ({
	memembershipapplicationsGetApplication: getApplicationMock,
	memembershipapplicationsCancel: cancelMock,
	memembershipapplicationsApply: applyMock
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeApplication(
	overrides: Partial<MembershipApplicationSchema> = {}
): MembershipApplicationSchema {
	return {
		id: 'app-1',
		organization_id: 'org-1',
		organization_name: 'Acme',
		organization_slug: 'acme',
		organization_logo_url: null,
		tier_id: null,
		tier_name: null,
		plan_id: null,
		subscription_id: null,
		questionnaire_submission_id: null,
		status: 'pending',
		message: null,
		created_at: '2026-07-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
		...overrides
	};
}

function makeEligibility(
	overrides: Partial<MembershipEligibilitySchema> = {}
): MembershipEligibilitySchema {
	return {
		allowed: false,
		organization_id: 'org-1',
		tier_id: null,
		plan_id: null,
		reason: null,
		reason_code: null,
		next_step: null,
		questionnaire_id: null,
		application_id: 'app-1',
		retry_on: null,
		...overrides
	};
}

function mockAdvance(payload: ApplyResponseSchema) {
	getApplicationMock.mockResolvedValue({ data: payload, error: undefined });
}

describe('ApplicationRow', () => {
	let queryClient: QueryClient;

	function renderRow(application: MembershipApplicationSchema) {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: ApplicationRow, componentProps: { application } }
		});
	}

	beforeEach(() => {
		getApplicationMock.mockReset();
		cancelMock.mockReset();
		applyMock.mockReset();
		vi.mocked(toast.success).mockReset();
		vi.mocked(toast.error).mockReset();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	it('names the organization, tier and application date', () => {
		mockAdvance({ application: makeApplication(), eligibility: makeEligibility() });
		renderRow(makeApplication({ tier_name: 'Gold' }));

		expect(screen.getByRole('link', { name: 'Acme' })).toHaveAttribute('href', '/org/acme');
		expect(screen.getByText(/Tier: Gold/)).toBeInTheDocument();
		expect(screen.getByText(/Applied on/)).toBeInTheDocument();
	});

	// A closed application cannot advance, and the GET mutates server state — so a
	// terminal row must never spend a request on it.
	it('never re-reads a terminal application', async () => {
		renderRow(makeApplication({ status: 'rejected' }));

		expect(screen.getByText('Rejected')).toBeInTheDocument();
		// Give the query a tick to fire if the `enabled` guard were missing.
		await waitFor(() => expect(getApplicationMock).not.toHaveBeenCalled());
	});

	it('re-reads a non-terminal application exactly once and shows the advanced status', async () => {
		mockAdvance({
			application: makeApplication({ status: 'approved' }),
			eligibility: makeEligibility()
		});
		renderRow(makeApplication({ status: 'pending' }));

		expect(await screen.findByText('Approved')).toBeInTheDocument();
		expect(getApplicationMock).toHaveBeenCalledTimes(1);
		expect(getApplicationMock).toHaveBeenCalledWith(
			expect.objectContaining({ path: { application_id: 'app-1' } })
		);
	});

	it('announces the new membership and refreshes both member lists when the read completes it', async () => {
		mockAdvance({
			application: makeApplication({ status: 'completed' }),
			eligibility: makeEligibility({ allowed: true, next_step: 'already_member' })
		});
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
		renderRow(makeApplication({ status: 'approved' }));

		const status = await screen.findByRole('status');
		expect(status).toHaveTextContent(/now a member of Acme/i);

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me', 'memberships'] });
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me', 'subscriptions'] });
		});
		// Once-guarded: a re-render must not re-fire the invalidation storm.
		expect(
			invalidateSpy.mock.calls.filter(
				(call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: ['me', 'memberships'] })
			)
		).toHaveLength(1);
	});

	it('links to the org-scoped questionnaire when one is the next step', async () => {
		mockAdvance({
			application: makeApplication(),
			eligibility: makeEligibility({
				next_step: 'submit_questionnaire',
				questionnaire_id: 'q1',
				reason_code: 'membership_questionnaire_missing'
			})
		});
		renderRow(makeApplication());

		const link = await screen.findByRole('link', { name: /continue questionnaire/i });
		expect(link).toHaveAttribute('href', '/org/acme/questionnaire/q1');
	});

	// A tier-less PENDING application passes every gate, so the verdict comes back
	// `allowed` with no signals at all. The raw status message would read "you
	// can't join right now"; the application-scoped helper says the truth.
	it('explains a silent pending verdict as waiting on the organization', async () => {
		mockAdvance({
			application: makeApplication({ status: 'pending' }),
			eligibility: makeEligibility({ allowed: true })
		});
		renderRow(makeApplication({ status: 'pending' }));

		expect(await screen.findByText(/with the organization/i)).toBeInTheDocument();
	});

	it('renders the wait copy for an approval verdict that carries no reason code', async () => {
		mockAdvance({
			application: makeApplication({ status: 'pending' }),
			eligibility: makeEligibility({ next_step: 'wait_for_approval' })
		});
		renderRow(makeApplication({ status: 'pending' }));

		expect(await screen.findByText(/with the organization/i)).toBeInTheDocument();
	});

	// Closed rows must not get a next-step line: `getApplicationPendingMessage`
	// keys off signal-absence and would mislabel a settled verdict.
	it('shows no next-step line on a closed row', async () => {
		renderRow(makeApplication({ status: 'cancelled' }));

		expect(screen.getByText('Cancelled')).toBeInTheDocument();
		await waitFor(() => expect(getApplicationMock).not.toHaveBeenCalled());
		expect(screen.queryByText(/with the organization/i)).toBeNull();
		expect(screen.queryByRole('link', { name: /continue questionnaire/i })).toBeNull();
	});

	// The chip must not encode meaning in colour alone.
	it('labels the status chip for assistive tech', () => {
		renderRow(makeApplication({ status: 'rejected' }));

		expect(screen.getByLabelText('Application status: Rejected')).toHaveTextContent('Rejected');
	});

	describe('actions', () => {
		// Only an application the backend can still move is cancellable; a settled
		// one is offered the re-apply route instead (and a completed one neither).
		//
		// The advanced chip is awaited *before* the button assertion: the pending
		// render already carries the button, so asserting it first would resolve
		// against the pre-advance markup and let a pending-only gate pass.
		it('keeps cancel offered when the advance reports an approved application', async () => {
			mockAdvance({
				application: makeApplication({ status: 'approved' }),
				eligibility: makeEligibility()
			});
			renderRow(makeApplication({ status: 'pending' }));

			expect(await screen.findByText('Approved')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Cancel application' })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'Re-apply for membership' })).toBeNull();
		});

		// The same gate from the other direction: a row whose *list* status is
		// already `approved` never passes through a pending render at all.
		it('offers cancel on a row that arrives already approved', async () => {
			mockAdvance({
				application: makeApplication({ status: 'approved' }),
				eligibility: makeEligibility()
			});
			renderRow(makeApplication({ status: 'approved' }));

			await waitFor(() => expect(getApplicationMock).toHaveBeenCalledTimes(1));
			expect(screen.getByRole('button', { name: 'Cancel application' })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'Re-apply for membership' })).toBeNull();
		});

		// The advance cache outlives the row's own status. After a successful
		// cancel the list refetches and hands this row a terminal application, but
		// the pre-cancel payload is still cached under ['me','application',id] —
		// and that query is now disabled, so no refetch can ever correct it (nor
		// should one: the GET advances server state). A terminal prop must
		// therefore beat the cache, or the Closed row keeps a Pending chip, the
		// wait copy and a live Cancel button until a full page reload.
		it('ignores a stale advance payload once the list row is terminal', async () => {
			mockAdvance({
				application: makeApplication({ status: 'pending' }),
				eligibility: makeEligibility({ next_step: 'wait_for_approval' })
			});
			const { rerender } = render(QueryClientTestWrapper, {
				props: {
					client: queryClient,
					component: ApplicationRow,
					componentProps: { application: makeApplication({ status: 'pending' }) }
				}
			});

			// The wait copy comes only from the advanced payload — proof the cache
			// is populated before the row goes terminal.
			expect(await screen.findByText(/with the organization/i)).toBeInTheDocument();

			await rerender({
				client: queryClient,
				component: ApplicationRow,
				componentProps: { application: makeApplication({ status: 'cancelled' }) }
			});

			expect(await screen.findByText('Cancelled')).toBeInTheDocument();
			expect(screen.queryByText(/with the organization/i)).toBeNull();
			expect(screen.queryByRole('button', { name: 'Cancel application' })).toBeNull();
			expect(screen.getByRole('button', { name: 'Re-apply for membership' })).toBeInTheDocument();
		});

		it('offers neither action on a completed application', async () => {
			renderRow(makeApplication({ status: 'completed' }));

			expect(screen.getByText('Completed')).toBeInTheDocument();
			await waitFor(() => expect(getApplicationMock).not.toHaveBeenCalled());
			expect(screen.queryByRole('button', { name: 'Cancel application' })).toBeNull();
			expect(screen.queryByRole('button', { name: 'Re-apply for membership' })).toBeNull();
		});

		it('cancels the application on confirmation and refreshes the list', async () => {
			const user = userEvent.setup();
			mockAdvance({
				application: makeApplication({ status: 'pending' }),
				eligibility: makeEligibility()
			});
			cancelMock.mockResolvedValue({
				data: makeApplication({ status: 'cancelled' }),
				error: undefined
			});
			const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
			renderRow(makeApplication({ status: 'pending' }));

			await user.click(await screen.findByRole('button', { name: 'Cancel application' }));
			expect(await screen.findByRole('dialog')).toHaveTextContent('Cancel this application?');

			await user.click(screen.getByRole('button', { name: 'Confirm' }));

			await waitFor(() =>
				expect(cancelMock).toHaveBeenCalledWith(
					expect.objectContaining({ path: { application_id: 'app-1' } })
				)
			);
			await waitFor(() =>
				expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me', 'applications'] })
			);
			expect(toast.success).toHaveBeenCalledWith('Application cancelled.');
		});

		it('does not cancel when the confirmation is declined', async () => {
			const user = userEvent.setup();
			mockAdvance({
				application: makeApplication({ status: 'pending' }),
				eligibility: makeEligibility()
			});
			renderRow(makeApplication({ status: 'pending' }));

			await user.click(await screen.findByRole('button', { name: 'Cancel application' }));
			await user.click(await screen.findByRole('button', { name: 'Cancel' }));

			expect(cancelMock).not.toHaveBeenCalled();
		});

		// hey-api resolves rather than throws, so the backend's own wording has to
		// be dug out of the resolved error body.
		it('surfaces the backend reason when the cancellation fails', async () => {
			const user = userEvent.setup();
			mockAdvance({
				application: makeApplication({ status: 'pending' }),
				eligibility: makeEligibility()
			});
			cancelMock.mockResolvedValue({ data: undefined, error: { detail: 'Already settled.' } });
			renderRow(makeApplication({ status: 'pending' }));

			await user.click(await screen.findByRole('button', { name: 'Cancel application' }));
			await user.click(await screen.findByRole('button', { name: 'Confirm' }));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Already settled.'));
		});

		it('opens the apply dialog in re-apply framing from a rejected application', async () => {
			const user = userEvent.setup();
			renderRow(makeApplication({ status: 'rejected' }));

			expect(screen.queryByRole('button', { name: 'Cancel application' })).toBeNull();
			await user.click(screen.getByRole('button', { name: 'Re-apply for membership' }));

			expect(await screen.findByText('Re-apply to Acme')).toBeInTheDocument();
		});

		// The other arm of the re-apply gate: a member who withdrew must be able
		// to come back the same way a rejected one can.
		it('offers re-apply on a cancelled application', async () => {
			renderRow(makeApplication({ status: 'cancelled' }));

			expect(screen.getByRole('button', { name: 'Re-apply for membership' })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'Cancel application' })).toBeNull();
		});

		// Since BE #812 `advance_application` auto-rejects a PENDING row whose
		// verdict carries a terminal code — and the attempts cap is one. Re-applying
		// creates a fresh PENDING row that the same gate rejects on the same read,
		// with a second rejection notification: a loop that can only fail.
		it('withholds re-apply when the read itself auto-rejected the row', async () => {
			mockAdvance({
				application: makeApplication({ status: 'rejected' }),
				eligibility: makeEligibility({
					allowed: false,
					next_step: null,
					reason_code: 'membership_questionnaire_attempts_exhausted',
					questionnaire_id: 'q1'
				})
			});
			renderRow(makeApplication({ status: 'pending' }));

			expect(await screen.findByText('Rejected')).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'Re-apply for membership' })).toBeNull();
			expect(screen.queryByRole('button', { name: 'Cancel application' })).toBeNull();
		});

		// Withholding the button is only half of it — the row flipped under the
		// member, so it has to say why rather than leave a bare Rejected chip.
		it('explains the auto-rejection in place of the withheld action', async () => {
			mockAdvance({
				application: makeApplication({ status: 'rejected' }),
				eligibility: makeEligibility({
					allowed: false,
					next_step: null,
					reason_code: 'membership_questionnaire_attempts_exhausted',
					questionnaire_id: 'q1'
				})
			});
			renderRow(makeApplication({ status: 'pending' }));

			expect(await screen.findByRole('status')).toHaveTextContent(/all your attempts/i);
			// The verdict names a questionnaire, but there is nothing left to do in it.
			expect(screen.queryByRole('link', { name: /continue questionnaire/i })).toBeNull();
		});

		// The discriminator: a staff rejection landing in the same read comes back
		// with `next_step: 'reapply'` from ApplicationStatusGate, and re-applying is
		// then the documented recourse. The gate must not swallow it.
		it('still offers re-apply when the rejection verdict points at re-applying', async () => {
			mockAdvance({
				application: makeApplication({ status: 'rejected' }),
				eligibility: makeEligibility({
					allowed: false,
					next_step: 'reapply',
					reason_code: 'application_rejected'
				})
			});
			renderRow(makeApplication({ status: 'pending' }));

			expect(await screen.findByText('Rejected')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Re-apply for membership' })).toBeInTheDocument();
		});

		// A row that arrives already rejected never runs the advance, so the FE holds
		// no verdict at all — and the backend's own answer for it is `reapply`.
		// Unchanged behaviour, pinned so the guard above cannot creep onto it.
		it('leaves a row that arrived rejected on its ordinary re-apply path', async () => {
			renderRow(makeApplication({ status: 'rejected' }));

			await waitFor(() => expect(getApplicationMock).not.toHaveBeenCalled());
			expect(screen.getByRole('button', { name: 'Re-apply for membership' })).toBeInTheDocument();
		});
	});
});
