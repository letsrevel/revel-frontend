import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { SUBMISSION_BADGE_STATUS_ORDER } from '$lib/utils/questionnaire-types';
import SubmissionStatusBadge from './SubmissionStatusBadge.svelte';

/**
 * REGRESSION GUARD, same shape as `members/SubscriptionStatusBadge.test.ts`:
 * this pill's status TEXT is a cross-surface contract (the submissions table and
 * the submission detail page locate it by that text, which since #795 is also
 * its accessible name), not decoration. Every status is pinned, not a sample —
 * the failure mode drops all of them at once.
 */
const LABELS: Record<(typeof SUBMISSION_BADGE_STATUS_ORDER)[number], string> = {
	draft: 'Draft',
	'pending review': 'Pending',
	approved: 'Approved',
	auto_accepted: 'Auto-accepted',
	rejected: 'Rejected'
};

describe('questionnaires/SubmissionStatusBadge', () => {
	it.each(SUBMISSION_BADGE_STATUS_ORDER)('renders the %s label on the pill', (status) => {
		render(SubmissionStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	it('collapses approved and auto_accepted onto the same tone, distinguished by label', () => {
		const approved = render(SubmissionStatusBadge, { props: { status: 'approved' } });
		const approvedEl = approved.container.querySelector('span') as HTMLElement;
		expect(approvedEl.className).toContain('bg-success');

		const auto = render(SubmissionStatusBadge, { props: { status: 'auto_accepted' } });
		const autoEl = auto.container.querySelector('span') as HTMLElement;
		expect(autoEl.className).toContain('bg-success');

		expect(screen.getByText('Approved')).toBeInTheDocument();
		expect(screen.getByText('Auto-accepted')).toBeInTheDocument();
	});

	it('maps rejected to danger', () => {
		const { container } = render(SubmissionStatusBadge, { props: { status: 'rejected' } });
		expect(container.querySelector('span')?.className).toContain('bg-destructive');
	});

	it('keeps the caller class alongside the tone classes', () => {
		const { container } = render(SubmissionStatusBadge, {
			props: { status: 'draft', class: 'shrink-0' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('shrink-0');
	});
});
