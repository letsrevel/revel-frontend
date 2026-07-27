import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MembershipRequestCard from './MembershipRequestCard.svelte';
import type {
	MembershipRequestStatus,
	OrganizationMembershipRequestRetrieve
} from '$lib/api/generated/types.gen';

const baseRequest = {
	id: 'req-1',
	status: 'pending',
	message: 'Please let me in',
	created_at: '2026-07-20T10:00:00Z',
	user: {
		id: 'user-1',
		email: 'applicant@example.com',
		first_name: 'Ada',
		last_name: 'Lovelace',
		preferred_name: null,
		pronouns: null,
		profile_picture_url: null,
		profile_picture_thumbnail_url: null,
		profile_picture_preview_url: null
	}
} as unknown as OrganizationMembershipRequestRetrieve;

function makeRequest(
	overrides: Partial<OrganizationMembershipRequestRetrieve>
): OrganizationMembershipRequestRetrieve {
	return { ...baseRequest, ...overrides } as OrganizationMembershipRequestRetrieve;
}

function renderCard(
	request: OrganizationMembershipRequestRetrieve,
	props: { showActions?: boolean } = {}
) {
	return render(MembershipRequestCard, {
		props: { request, orgSlug: 'test-org', showActions: true, ...props }
	});
}

describe('MembershipRequestCard tier chip', () => {
	it('renders the tier name when the application carries a tier', () => {
		renderCard(makeRequest({ tier: { id: 't1', name: 'Gold' } as never }));
		expect(screen.getByText('Gold')).toBeInTheDocument();
	});

	it('names the chip for a screen reader instead of reading a bare word', () => {
		renderCard(makeRequest({ tier: { id: 't1', name: 'Gold' } as never }));
		expect(screen.getByText('Gold').parentElement).toHaveTextContent('Tier: Gold');
	});

	it('renders no tier chip when the application has no tier', () => {
		renderCard(makeRequest({ tier: null }));
		expect(screen.queryByText('Gold')).not.toBeInTheDocument();
	});
});

describe('MembershipRequestCard questionnaire submission', () => {
	it('links to the submission and flags a pending review', () => {
		renderCard(
			makeRequest({
				questionnaire_submission: {
					id: 'sub-1',
					org_questionnaire_id: 'oq-1',
					evaluation_status: 'pending review'
				}
			})
		);

		const links = screen.getAllByRole('link', { name: 'View questionnaire submission' });
		expect(links.length).toBeGreaterThan(0);
		expect(links[0]).toHaveAttribute(
			'href',
			'/org/test-org/admin/questionnaires/oq-1/submissions/sub-1'
		);
		expect(screen.getAllByText('Review pending').length).toBeGreaterThan(0);
	});

	it('describes the submission link with the review-pending hint', () => {
		renderCard(
			makeRequest({
				questionnaire_submission: {
					id: 'sub-1',
					org_questionnaire_id: 'oq-1',
					evaluation_status: 'pending review'
				}
			})
		);

		// The hint sits beside the link visually; without the association a screen
		// reader announces the link with no idea the review is still open.
		const link = screen.getAllByRole('link', { name: 'View questionnaire submission' })[0];
		const hintId = link.getAttribute('aria-describedby');
		expect(hintId).toBeTruthy();
		expect(document.getElementById(hintId as string)).toHaveTextContent('Review pending');
	});

	it('omits the review-pending hint once the submission is approved', () => {
		renderCard(
			makeRequest({
				questionnaire_submission: {
					id: 'sub-1',
					org_questionnaire_id: 'oq-1',
					evaluation_status: 'approved'
				}
			})
		);

		const links = screen.getAllByRole('link', { name: 'View questionnaire submission' });
		expect(links.length).toBeGreaterThan(0);
		expect(screen.queryByText('Review pending')).not.toBeInTheDocument();
		// No hint to point at, so no dangling description either.
		expect(links[0]).not.toHaveAttribute('aria-describedby');
	});

	it('renders no submission link when the application has none', () => {
		renderCard(makeRequest({ questionnaire_submission: null }));
		expect(
			screen.queryByRole('link', { name: 'View questionnaire submission' })
		).not.toBeInTheDocument();
	});
});

describe('MembershipRequestCard status badge', () => {
	const cases: [MembershipRequestStatus, string][] = [
		['approved', 'Approved'],
		['rejected', 'Rejected'],
		['cancelled', 'Cancelled'],
		['completed', 'Completed'],
		['pending', 'Pending']
	];

	for (const [status, label] of cases) {
		it(`shows the localized "${label}" badge for status ${status}`, () => {
			renderCard(makeRequest({ status }), { showActions: false });
			expect(screen.getByText(label)).toBeInTheDocument();
		});
	}

	it('falls back to the neutral badge for a status this build does not know', () => {
		// BE-ahead version skew: an unguarded map lookup here would TypeError and
		// take down every card in the tab, not just this one row.
		const unknownStatus = 'weird' as unknown as MembershipRequestStatus;
		renderCard(makeRequest({ status: unknownStatus }), { showActions: false });
		expect(screen.getByText('Pending')).toBeInTheDocument();
	});
});

describe('MembershipRequestCard relative date', () => {
	it('renders the request date as a locale-aware relative phrase', () => {
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		renderCard(makeRequest({ created_at: oneHourAgo }));
		expect(screen.getAllByText(/Requested 1 hour ago/).length).toBeGreaterThan(0);
	});
});
