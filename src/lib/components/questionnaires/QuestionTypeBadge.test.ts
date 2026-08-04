import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import QuestionTypeBadge from './QuestionTypeBadge.svelte';

type QuestionType = 'multiple_choice' | 'free_text' | 'file_upload';

/**
 * REGRESSION GUARD, same shape as the other rebrand `StatusBadge` mappers:
 * this pill's accessible NAME is not decoration. `common/StatusBadge` defaults
 * one from the visible label since #788, and the mapper passes it explicitly
 * too; this guards every question type, not just a sample, against that name
 * silently vanishing whichever of the two supplies it.
 */
const TYPE_ORDER: QuestionType[] = ['multiple_choice', 'free_text', 'file_upload'];
const LABELS: Record<QuestionType, string> = {
	multiple_choice: 'Multiple Choice',
	free_text: 'Free Text',
	file_upload: 'File Upload'
};
const EXPECTED_TONE_CLASS: Record<QuestionType, string> = {
	multiple_choice: 'bg-info',
	free_text: 'bg-primary',
	file_upload: 'bg-success'
};

describe('questionnaires/QuestionTypeBadge', () => {
	it.each(TYPE_ORDER)('exposes the %s label as the pill accessible name', (type) => {
		const label = LABELS[type];
		render(QuestionTypeBadge, { props: { type, label } });
		expect(screen.getByLabelText(label)).toBeInTheDocument();
		expect(screen.getByLabelText(label)).toHaveTextContent(label);
	});

	it.each(TYPE_ORDER)('maps %s to its tone class', (type) => {
		const { container } = render(QuestionTypeBadge, { props: { type, label: LABELS[type] } });
		expect(container.querySelector('span')?.className).toContain(EXPECTED_TONE_CLASS[type]);
	});

	it('keeps the caller class alongside the tone classes', () => {
		const { container } = render(QuestionTypeBadge, {
			props: { type: 'multiple_choice', label: 'MC', class: 'shrink-0' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('shrink-0');
	});
});
