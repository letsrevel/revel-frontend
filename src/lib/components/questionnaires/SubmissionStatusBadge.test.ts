import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { SUBMISSION_BADGE_STATUS_ORDER } from '$lib/utils/questionnaire-types';
import SubmissionStatusBadge from './SubmissionStatusBadge.svelte';

/**
 * REGRESSION GUARD, same shape as `members/StatusBadge.test.ts`: this pill's
 * accessible NAME is a cross-surface contract (the submissions table and the
 * submission detail page locate it by its status text), not decoration. The
 * rebrand turned this into a thin mapper over `common/StatusBadge`, which does
 * not default an `aria-label` from its content — so this guards every status,
 * not just a sample, against that name silently vanishing again.
 */
const LABELS: Record<(typeof SUBMISSION_BADGE_STATUS_ORDER)[number], string> = {
	draft: 'Draft',
	'pending review': 'Pending',
	approved: 'Approved',
	auto_accepted: 'Auto-accepted',
	rejected: 'Rejected'
};

describe('questionnaires/SubmissionStatusBadge', () => {
	it.each(SUBMISSION_BADGE_STATUS_ORDER)(
		'exposes the %s label as the pill accessible name',
		(status) => {
			render(SubmissionStatusBadge, { props: { status } });
			const label = LABELS[status];
			expect(screen.getByLabelText(label)).toBeInTheDocument();
			expect(screen.getByLabelText(label)).toHaveTextContent(label);
		}
	);

	it('collapses approved and auto_accepted onto the same tone, distinguished by label', () => {
		const approved = render(SubmissionStatusBadge, { props: { status: 'approved' } });
		const approvedEl = approved.container.querySelector('span') as HTMLElement;
		expect(approvedEl.className).toContain('bg-success');

		const auto = render(SubmissionStatusBadge, { props: { status: 'auto_accepted' } });
		const autoEl = auto.container.querySelector('span') as HTMLElement;
		expect(autoEl.className).toContain('bg-success');

		expect(screen.getByLabelText('Approved')).toBeInTheDocument();
		expect(screen.getByLabelText('Auto-accepted')).toBeInTheDocument();
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
