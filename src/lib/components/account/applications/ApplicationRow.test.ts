import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import ApplicationRow from './ApplicationRow.svelte';
import type {
	ApplyResponseSchema,
	MembershipApplicationSchema,
	MembershipEligibilitySchema
} from '$lib/api/generated/types.gen';

const getApplicationMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	memembershipapplicationsGetApplication: getApplicationMock
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

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
			props: { client: queryClient, component: ApplicationRow, props: { application } }
		});
	}

	beforeEach(() => {
		getApplicationMock.mockReset();
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
});
