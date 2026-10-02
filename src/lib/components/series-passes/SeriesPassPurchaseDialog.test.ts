import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeriesPassPurchaseDialog from './SeriesPassPurchaseDialog.svelte';
import { seriespassCheckoutSeriesPass } from '$lib/api/generated/sdk.gen';
import type { SeriesPassSchema, SeriesPassQuoteSchema } from '$lib/api/generated/types.gen';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	seriespassCheckoutSeriesPass: vi.fn(),
	seriespassSeriesPassCheckoutSession: vi.fn(),
	eventpublicticketsCheckoutSession: vi.fn(),
	eventpublicguestGuestCheckoutSession: vi.fn()
}));

const pass = {
	id: 'pass-1',
	name: 'IT Season Pass',
	description: null,
	price: '30.00',
	pro_rata_discount: '0.00',
	currency: 'EUR',
	payment_method: 'online',
	purchasable_by: 'public',
	sales_start_at: null,
	sales_end_at: null
} as SeriesPassSchema;

const quote = {
	price: '30.00',
	passed_events: 0,
	remaining_events: 2,
	currency: 'EUR',
	purchasable: true,
	reason: null,
	// A stale quote: it said allowed, but checkout now refuses.
	compliance: { online_payment: 'allowed' }
} as SeriesPassQuoteSchema;

function refuse(body: unknown) {
	vi.mocked(seriespassCheckoutSeriesPass).mockResolvedValue({
		data: undefined,
		error: body,
		response: { ok: false, status: 422 } as Response
	} as unknown as Awaited<ReturnType<typeof seriespassCheckoutSeriesPass>>);
}

function renderDialog() {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
			component: SeriesPassPurchaseDialog,
			componentProps: { pass, quote, seriesId: 'series-1', onClose: vi.fn() }
		}
	});
}

// #1001 / #1005: the inline 422 stays the fallback behind the card's up-front state.
describe('SeriesPassPurchaseDialog — checkout refused (422)', () => {
	beforeEach(() => vi.clearAllMocks());

	it("renders the backend's detail inline as an alert; the button stays usable", async () => {
		refuse({ detail: "Online card payments aren't available for events in Italy." });
		renderDialog();
		const pay = screen.getByRole('button', { name: 'Continue to payment' });
		await userEvent.click(pay);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent("Online card payments aren't available for events in Italy.");
		// Not a dead end: once the request settles, retrying is still possible.
		await waitFor(() => expect(pay).toBeEnabled());
		expect(pay).toHaveAccessibleDescription(
			"Online card payments aren't available for events in Italy."
		);
	});

	it('falls back to the pass-specific copy when the 422 carries no detail', async () => {
		refuse({});
		renderDialog();
		await userEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
		expect(await screen.findByRole('alert')).toHaveTextContent(
			"This pass can't be bought online. Contact the organizer to find out how to pay."
		);
	});
});
