import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import RecurrenceSummary from './RecurrenceSummary.svelte';
import type { RecurrenceDescriptor } from '$lib/types/recurrence';

function makeWeeklyRule(weekdays: number[]): RecurrenceDescriptor {
	return {
		frequency: 'weekly',
		interval: 1,
		weekdays,
		monthly_type: null,
		day_of_month: null,
		nth_weekday: null,
		weekday: null,
		dtstart: '2026-05-01T18:00:00Z',
		until: null,
		count: null,
		timezone: 'UTC'
	};
}

describe('RecurrenceSummary', () => {
	it('renders nothing when rule is null', () => {
		const { container } = render(RecurrenceSummary, { props: { rule: null } });
		expect(container.textContent?.trim()).toBe('');
	});

	it('renders nothing when rule is undefined', () => {
		const { container } = render(RecurrenceSummary, { props: { rule: undefined } });
		expect(container.textContent?.trim()).toBe('');
	});

	it('renders a weekly summary from the rule', () => {
		const rule = makeWeeklyRule([0]);
		const { container } = render(RecurrenceSummary, { props: { rule } });
		// formatRecurrence uses the Phase-0 utility; we just need to confirm the
		// wrapper hands the rule through and renders it as a paragraph.
		const p = container.querySelector('p');
		expect(p).not.toBeNull();
		expect(p?.textContent ?? '').toMatch(/Monday/i);
	});

	it('announces changes via aria-live=polite for screen readers', () => {
		const rule = makeWeeklyRule([0, 2, 4]);
		const { container } = render(RecurrenceSummary, { props: { rule } });
		const p = container.querySelector('p');
		expect(p?.getAttribute('aria-live')).toBe('polite');
	});

	it('appends custom className to the paragraph', () => {
		const rule = makeWeeklyRule([0]);
		const { container } = render(RecurrenceSummary, {
			props: { rule, class: 'text-lg text-destructive' }
		});
		const p = container.querySelector('p');
		expect(p?.className).toContain('text-lg');
		expect(p?.className).toContain('text-destructive');
	});

	it('respects includeBoundary=false', () => {
		const rule: RecurrenceDescriptor = {
			...makeWeeklyRule([0]),
			count: 10
		};
		const { container: withBoundary } = render(RecurrenceSummary, { props: { rule } });
		const { container: withoutBoundary } = render(RecurrenceSummary, {
			props: { rule, includeBoundary: false }
		});
		// The boundary phrase ("for N occurrences") should be absent when disabled.
		expect(withBoundary.textContent ?? '').toMatch(/10/);
		expect(withoutBoundary.textContent ?? '').not.toMatch(/10/);
	});
});
