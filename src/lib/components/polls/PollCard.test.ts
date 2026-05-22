import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import PollCard from './PollCard.svelte';
import type { PollListItemSchema } from '$lib/api/generated/types.gen';

function makePoll(overrides: Partial<PollListItemSchema> = {}): PollListItemSchema {
	return {
		id: 'p1',
		organization_id: 'o1',
		event_id: null,
		questionnaire_name: 'Where to eat?',
		status: 'open',
		opened_at: '2026-05-22T10:00:00Z',
		closes_at: null,
		closed_at: null,
		vote_visibility: 'members-only',
		result_visibility: 'members-only',
		user_has_voted: false,
		user_can_vote: true,
		user_can_see_results: true,
		...overrides
	};
}

describe('PollCard', () => {
	it('shows the URL strip when poll is OPEN', () => {
		render(PollCard, {
			props: { poll: makePoll({ status: 'open' }), organizationSlug: 'acme' }
		});
		const input = screen.getByRole('textbox', { name: /share url/i });
		expect((input as HTMLInputElement).value).toContain('/org/acme/polls/p1');
	});

	it('shows the Open poll CTA and hides the URL strip when DRAFT', () => {
		render(PollCard, {
			props: { poll: makePoll({ status: 'draft' }), organizationSlug: 'acme' }
		});
		expect(screen.getByRole('button', { name: /open poll/i })).toBeInTheDocument();
		expect(screen.queryByRole('textbox', { name: /share url/i })).toBeNull();
	});

	it('shows the Closed badge when poll is CLOSED', () => {
		render(PollCard, {
			props: { poll: makePoll({ status: 'closed' }), organizationSlug: 'acme' }
		});
		expect(screen.getByText(/closed/i)).toBeInTheDocument();
	});
});
