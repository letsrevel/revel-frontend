import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { QuestionnaireStatus } from '$lib/api/generated/types.gen';
import QuestionnaireStatusBadge from './QuestionnaireStatusBadge.svelte';

/**
 * REGRESSION GUARD, same shape as `members/SubscriptionStatusBadge.test.ts` and
 * `polls/PollStatusBadge`'s sibling `SubmissionStatusBadge.test.ts`: this
 * pill's accessible NAME is not decoration, and `common/StatusBadge` does not
 * default an `aria-label` from its text content. This guards every status,
 * not just a sample, against that name silently vanishing.
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
	it.each(STATUS_ORDER)('exposes the %s label as the pill accessible name', (status) => {
		const label = LABELS[status];
		render(QuestionnaireStatusBadge, { props: { status, label } });
		expect(screen.getByLabelText(label)).toBeInTheDocument();
		expect(screen.getByLabelText(label)).toHaveTextContent(label);
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
