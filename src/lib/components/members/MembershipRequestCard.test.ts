import { render, screen, within } from '@testing-library/svelte';
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

describe('MembershipRequestCard card semantics', () => {
	// Contract relied on by the E2E helpers: role `article`, accessible name =
	// the requester's display name. Without it a page-global helper can only work
	// while exactly one card is on screen.
	it('exposes the card as an article named after the requester', () => {
		renderCard(makeRequest({}));
		expect(screen.getByRole('article', { name: 'Ada Lovelace' })).toBeInTheDocument();
	});

	it('prefers the preferred name for the accessible name', () => {
		renderCard(
			makeRequest({
				user: { ...baseRequest.user, preferred_name: 'Ada' }
			} as Partial<OrganizationMembershipRequestRetrieve>)
		);
		expect(screen.getByRole('article', { name: 'Ada' })).toBeInTheDocument();
	});

	it('lets a query scope to one card while several are mounted', () => {
		renderCard(makeRequest({}));
		renderCard(
			makeRequest({
				id: 'req-2',
				user: { ...baseRequest.user, id: 'user-2', first_name: 'Grace', last_name: 'Hopper' }
			} as Partial<OrganizationMembershipRequestRetrieve>)
		);

		const grace = screen.getByRole('article', { name: 'Grace Hopper' });
		expect(
			within(grace).getByRole('button', { name: 'Approve request from Grace Hopper' })
		).toBeInTheDocument();
		expect(within(grace).queryByText('Ada Lovelace')).not.toBeInTheDocument();
	});
});

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

		const links = screen.getAllByRole('link', {
			name: 'View questionnaire submission (review pending)'
		});
		expect(links.length).toBeGreaterThan(0);
		expect(links[0]).toHaveAttribute(
			'href',
			'/org/test-org/admin/questionnaires/oq-1/submissions/sub-1'
		);
		expect(screen.getAllByText('Review pending').length).toBeGreaterThan(0);
	});

	it('carries the review-pending state in the link’s accessible name', () => {
		renderCard(
			makeRequest({
				questionnaire_submission: {
					id: 'sub-1',
					org_questionnaire_id: 'oq-1',
					evaluation_status: 'pending review'
				}
			})
		);

		// The state has to be in the NAME, not in an `aria-describedby` hint: the
		// rotor / Elements-List link pickers a blind admin uses to jump straight to
		// a link expose the accessible name and nothing else, so a described-by
		// hint drops the caveat exactly where it is needed most.
		const links = screen.getAllByRole('link', {
			name: 'View questionnaire submission (review pending)'
		});
		expect(links.length).toBeGreaterThan(0);

		// The visible label survives inside the accessible name — WCAG 2.5.3 Label
		// in Name, so "click View questionnaire submission" still works by voice.
		for (const link of links) {
			expect(link.getAttribute('aria-label')).toContain(link.textContent?.trim());
			// No described-by on top of the name, or the same three words get
			// announced twice over (name, then description).
			expect(link).not.toHaveAttribute('aria-describedby');
		}

		// …and for the same reason the visible hint beside the link is hidden from
		// AT: it is now pure decoration, and browse mode would otherwise read the
		// link's name and then the span — the caveat twice in one line. This is
		// only safe while the name carries the state, which the assertion above
		// pins, so the two must never drift apart.
		for (const hint of screen.getAllByText('Review pending')) {
			expect(hint).toHaveAttribute('aria-hidden', 'true');
		}
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
		// A settled submission carries no caveat: the name is the plain visible
		// label, with no override and no dangling description.
		expect(links[0]).not.toHaveAttribute('aria-describedby');
		expect(links[0]).not.toHaveAttribute('aria-label');
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
