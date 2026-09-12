import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TicketingStep from './TicketingStep.svelte';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadminticketsListTicketTiers: vi.fn(async () => ({ data: [], error: undefined })),
	eventadminticketsReorderTicketTiers: vi.fn(async () => ({ data: [], error: undefined })),
	eventadminticketsUpdateTicketTier: vi.fn(async () => ({ data: {}, error: undefined })),
	organizationadminmembersListMembershipTiers: vi.fn(async () => ({
		data: [],
		error: undefined
	}))
}));

describe('TicketingStep — max tickets per user', () => {
	let queryClient: QueryClient;
	let onUpdate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		onUpdate = vi.fn();
	});

	function renderStep(maxTicketsPerUser: number | null = 1) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: TicketingStep,
				componentProps: {
					eventId: 'event-1',
					organizationSlug: 'org',
					organizationStripeConnected: false,
					formData: { max_tickets_per_user: maxTicketsPerUser },
					onUpdate,
					onBack: vi.fn(),
					onNext: vi.fn()
				}
			}
		});
	}

	function maxTicketsField(): HTMLInputElement {
		return screen.getByLabelText(/max tickets per user/i) as HTMLInputElement;
	}

	it('lets the user clear the field instead of snapping it back to 1', async () => {
		renderStep(1);
		const input = maxTicketsField();
		expect(input.value).toBe('1');

		// The whole bug: backspacing the only digit refilled the input with "1",
		// so the digit could never be deleted — only appended to.
		await fireEvent.input(input, { target: { value: '' } });

		expect(input.value).toBe('');
	});

	it('accepts a replacement value typed after clearing the field', async () => {
		renderStep(1);
		const input = maxTicketsField();

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.input(input, { target: { value: '5' } });

		expect(input.value).toBe('5');
		expect(onUpdate).toHaveBeenLastCalledWith({ max_tickets_per_user: 5 });
	});

	it('does not commit a value while the field is empty', async () => {
		renderStep(5);
		const input = maxTicketsField();

		await fireEvent.input(input, { target: { value: '' } });

		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('normalizes an empty field back to 1 on blur', async () => {
		renderStep(5);
		const input = maxTicketsField();

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.blur(input);

		expect(input.value).toBe('1');
		expect(onUpdate).toHaveBeenLastCalledWith({ max_tickets_per_user: 1 });
	});

	it('normalizes 0 back to 1 on blur but allows it while typing', async () => {
		renderStep(1);
		const input = maxTicketsField();

		// "0" is a legal keystroke on the way to "10", but it must not be committed.
		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.input(input, { target: { value: '0' } });
		expect(input.value).toBe('0');
		expect(onUpdate).not.toHaveBeenCalled();

		await fireEvent.input(input, { target: { value: '10' } });
		expect(input.value).toBe('10');
		expect(onUpdate).toHaveBeenLastCalledWith({ max_tickets_per_user: 10 });

		await fireEvent.input(input, { target: { value: '0' } });
		await fireEvent.blur(input);
		expect(input.value).toBe('1');
		expect(onUpdate).toHaveBeenLastCalledWith({ max_tickets_per_user: 1 });
	});

	it('never commits a truncated prefix of a decimal or exponent while typing', async () => {
		renderStep(1);
		const input = maxTicketsField();

		// type=number hands the page "1.5" / "1e2" verbatim — both are valid
		// floating-point literals — and parseInt would have committed 1 for either.
		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.input(input, { target: { value: '1.5' } });
		expect(onUpdate).not.toHaveBeenCalled();

		await fireEvent.input(input, { target: { value: '1e2' } });
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('settles a decimal or exponent to the entered number on blur', async () => {
		renderStep(1);
		const input = maxTicketsField();

		await fireEvent.input(input, { target: { value: '10.5' } });
		await fireEvent.blur(input);
		expect(input.value).toBe('10');
		expect(onUpdate).toHaveBeenLastCalledWith({ max_tickets_per_user: 10 });

		await fireEvent.input(input, { target: { value: '1e2' } });
		await fireEvent.blur(input);
		expect(input.value).toBe('100');
		expect(onUpdate).toHaveBeenLastCalledWith({ max_tickets_per_user: 100 });
	});

	it('falls back to the minimum for a negative or unparseable entry on blur', async () => {
		renderStep(5);
		const input = maxTicketsField();

		await fireEvent.input(input, { target: { value: '-5' } });
		await fireEvent.blur(input);

		expect(input.value).toBe('1');
		expect(onUpdate).toHaveBeenLastCalledWith({ max_tickets_per_user: 1 });
	});

	it('strips leading zeros on blur', async () => {
		renderStep(1);
		const input = maxTicketsField();

		await fireEvent.input(input, { target: { value: '05' } });
		await fireEvent.blur(input);

		expect(input.value).toBe('5');
		expect(onUpdate).toHaveBeenLastCalledWith({ max_tickets_per_user: 5 });
	});
});
