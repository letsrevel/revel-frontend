import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import RecurrenceEditDialog from './RecurrenceEditDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	EventSeriesRecurrenceDetailSchema,
	MinimalEventSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminrecurringeventsUpdateRecurrence: vi.fn()
}));
vi.mock('svelte-sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

function makeMinimalTemplate(): MinimalEventSchema {
	return {
		id: 'evt_template',
		name: 'Weekly Run',
		slug: 'weekly-run',
		start: '2026-08-01T18:00:00Z',
		end: '2026-08-01T20:00:00Z',
		status: 'open',
		event_type: 'public'
	} as MinimalEventSchema;
}

function makeSeries(
	overrides: Partial<EventSeriesRecurrenceDetailSchema> = {}
): EventSeriesRecurrenceDetailSchema {
	return {
		id: 'ser_1',
		name: 'Weekly Run Club',
		slug: 'weekly-run-club',
		description: 'Every Monday at 6pm.',
		is_active: true,
		auto_publish: false,
		generation_window_weeks: 8,
		exdates: [],
		last_generated_until: '2026-07-01T18:00:00Z',
		recurrence_rule: null,
		template_event: makeMinimalTemplate(),
		...overrides
	};
}

/**
 * The generation-window field is the #922 bug almost verbatim: `Number('')` is 0,
 * which clamped up to 1 and refilled the input under the caret, so the value could
 * only be appended to. It now commits only in-range weeks while typing and clamps
 * on blur (#924).
 */
describe('RecurrenceEditDialog — generation window', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
	});

	function renderDialog(generationWindowWeeks = 8) {
		render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: RecurrenceEditDialog,
				componentProps: {
					open: true,
					series: makeSeries({ generation_window_weeks: generationWindowWeeks }),
					organizationSlug: 'acme',
					accessToken: 'test-token',
					onClose: vi.fn()
				}
			}
		});
		return screen.getByTestId('recurrence-edit-window') as HTMLInputElement;
	}

	it('lets the field be cleared instead of refilling it with 1', async () => {
		const input = renderDialog(8);
		expect(input.value).toBe('8');

		await fireEvent.input(input, { target: { value: '' } });

		expect(input.value).toBe('');
	});

	it('accepts a replacement typed after clearing', async () => {
		const input = renderDialog(8);

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.input(input, { target: { value: '1' } });
		expect(input.value).toBe('1');

		await fireEvent.input(input, { target: { value: '12' } });
		expect(input.value).toBe('12');
	});

	it('normalizes an emptied field back to the series value on blur', async () => {
		const input = renderDialog(8);

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.blur(input);

		expect(input.value).toBe('8');
	});

	it('clamps an out-of-range entry to 1..52 on blur', async () => {
		const input = renderDialog(8);

		await fireEvent.input(input, { target: { value: '99' } });
		expect(input.value).toBe('99');

		await fireEvent.blur(input);
		expect(input.value).toBe('52');
	});

	it('strips leading zeros on blur', async () => {
		const input = renderDialog(8);

		await fireEvent.input(input, { target: { value: '04' } });
		await fireEvent.blur(input);

		expect(input.value).toBe('4');
	});
});
