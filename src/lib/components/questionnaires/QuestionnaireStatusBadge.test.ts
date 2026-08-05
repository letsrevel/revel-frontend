import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { QuestionnaireStatus } from '$lib/api/generated/types.gen';
import QuestionnaireStatusBadge from './QuestionnaireStatusBadge.svelte';

/**
 * REGRESSION GUARD, same shape as `members/SubscriptionStatusBadge.test.ts` and
 * its sibling `SubmissionStatusBadge.test.ts`: this pill's status text is not
 * decoration — it is what locates the badge, and since #795 it is the accessible
 * name too. Every status is pinned, not a sample.
 */
const STATUS_ORDER: QuestionnaireStatus[] = ['draft', 'ready', 'published'];
const LABELS: Record<QuestionnaireStatus, string> = {
	draft: 'Draft',
	ready: 'Ready',
	published: 'Published'
};
const EXPECTED_TONE_CLASS: Record<QuestionnaireStatus, string> = {
	draft: 'bg-highlight',
	ready: 'bg-info',
	published: 'bg-success'
};

describe('questionnaires/QuestionnaireStatusBadge', () => {
	it.each(STATUS_ORDER)('renders the %s label on the pill', (status) => {
		const label = LABELS[status];
		render(QuestionnaireStatusBadge, { props: { status, label } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	it.each(STATUS_ORDER)('maps %s to its tone class', (status) => {
		const { container } = render(QuestionnaireStatusBadge, {
			props: { status, label: LABELS[status] }
		});
		expect(container.querySelector('span')?.className).toContain(EXPECTED_TONE_CLASS[status]);
	});

	it('keeps the caller class alongside the tone classes', () => {
		const { container } = render(QuestionnaireStatusBadge, {
			props: { status: 'draft', label: 'Draft', class: 'shrink-0' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('shrink-0');
	});
});
