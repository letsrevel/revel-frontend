import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeriesPassCard from './SeriesPassCard.svelte';
import SeriesPassPurchaseDialog from './SeriesPassPurchaseDialog.svelte';
import {
	seriespassGetSeriesPassQuote,
	seriespassCheckoutSeriesPass,
	eventpublicdetailsGetEvent,
	eventpublicattendanceGetQuestionnaire
} from '$lib/api/generated/sdk.gen';
import type { SeriesPassSchema, SeriesPassQuoteSchema } from '$lib/api/generated/types.gen';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	seriespassGetSeriesPassQuote: vi.fn(),
	seriespassCheckoutSeriesPass: vi.fn(),
	seriespassSeriesPassCheckoutSession: vi.fn(),
	eventpublicticketsCheckoutSession: vi.fn(),
	eventpublicguestGuestCheckoutSession: vi.fn(),
	eventpublicdetailsGetEvent: vi.fn(),
	eventpublicattendanceGetQuestionnaire: vi.fn()
}));

const pass = {
	id: 'pass-1',
	name: 'Season',
	description: null,
	price: '30.00',
	pro_rata_discount: '0.00',
	currency: 'EUR',
	payment_method: 'online',
	purchasable_by: 'public',
	sales_start_at: null,
	sales_end_at: null
} as SeriesPassSchema;

const EVENTS: Record<string, { name: string; slug: string }> = {
	'event-a': { name: 'Opening night', slug: 'opening-night' },
	'event-b': { name: 'Finale', slug: 'finale' }
};
const QUESTIONNAIRES: Record<string, string> = {
	'q-series': 'House rules',
	'q-event': 'Finale vetting'
};

function mockLookups() {
	vi.mocked(eventpublicdetailsGetEvent).mockImplementation((async ({
		path
	}: {
		path: { event_id: string };
	}) => ({
		data: { ...EVENTS[path.event_id], organization: { slug: 'acme' } },
		error: undefined
	})) as unknown as typeof eventpublicdetailsGetEvent);
	vi.mocked(eventpublicattendanceGetQuestionnaire).mockImplementation((async ({
		path
	}: {
		path: { questionnaire_id: string };
	}) => ({
		data: { id: path.questionnaire_id, name: QUESTIONNAIRES[path.questionnaire_id] },
		error: undefined
	})) as unknown as typeof eventpublicattendanceGetQuestionnaire);
}

function mockQuote(overrides: Partial<SeriesPassQuoteSchema> = {}) {
	vi.mocked(seriespassGetSeriesPassQuote).mockResolvedValue({
		data: {
			price: '30.00',
			passed_events: 0,
			remaining_events: 2,
			currency: 'EUR',
			purchasable: true,
			reason: null,
			compliance: { online_payment: 'allowed' },
			questionnaires_missing: [],
			questionnaire_event_id: null,
			questionnaire_events: [],
			...overrides
		},
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as ReturnType<typeof seriespassGetSeriesPassQuote>);
}

function newClient() {
	return new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
}

describe('SeriesPassCard — questionnaire step', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLookups();
	});

	function renderCard() {
		return render(QueryClientTestWrapper, {
			props: {
				client: newClient(),
				component: SeriesPassCard,
				componentProps: { pass, seriesId: 'series-1', isAuthenticated: true }
			}
		});
	}

	it('lists each questionnaire by name, links it through its own event, and disables Buy', async () => {
		mockQuote({
			questionnaires_missing: ['q-series', 'q-event'],
			questionnaire_event_id: 'event-a',
			questionnaire_events: [
				{ questionnaire_id: 'q-series', event_id: 'event-a' },
				{ questionnaire_id: 'q-event', event_id: 'event-b' }
			]
		});
		renderCard();

		expect(await screen.findByText('Complete these questionnaires first')).toBeInTheDocument();
		expect(await screen.findByText('House rules')).toBeInTheDocument();
		expect(await screen.findByText('Finale vetting')).toBeInTheDocument();

		const links = await screen.findAllByTestId('pass-questionnaire-link');
		expect(links).toHaveLength(2);
		expect(links[0].getAttribute('href')).toContain(
			'/events/acme/opening-night/questionnaire/q-series'
		);
		expect(links[1].getAttribute('href')).toContain('/events/acme/finale/questionnaire/q-event');
		// The buyer comes back to the pass after submitting.
		expect(links[0].getAttribute('href')).toContain('returnUrl=');

		const buy = screen.getByRole('button', { name: 'Get season pass' });
		expect(buy).toBeDisabled();
		expect(buy).toHaveAccessibleDescription(/Complete these questionnaires first/);
	});

	it('enables Buy and shows no step when nothing is missing', async () => {
		mockQuote();
		renderCard();
		const buy = await screen.findByRole('button', { name: 'Get season pass' });
		await waitFor(() => expect(buy).toBeEnabled());
		expect(screen.queryByTestId('pass-questionnaire-steps')).not.toBeInTheDocument();
	});
});

describe('SeriesPassPurchaseDialog — checkout 400 fallback', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLookups();
	});

	const quote = {
		price: '30.00',
		passed_events: 0,
		remaining_events: 2,
		currency: 'EUR',
		purchasable: true,
		reason: null,
		compliance: { online_payment: 'allowed' },
		questionnaires_missing: [],
		questionnaire_event_id: null,
		questionnaire_events: []
	} as SeriesPassQuoteSchema;

	function refuse(status: number, body: unknown) {
		vi.mocked(seriespassCheckoutSeriesPass).mockResolvedValue({
			data: undefined,
			error: body,
			response: { ok: false, status } as Response
		} as unknown as Awaited<ReturnType<typeof seriespassCheckoutSeriesPass>>);
	}

	async function openAndBuy() {
		render(QueryClientTestWrapper, {
			props: {
				client: newClient(),
				component: SeriesPassPurchaseDialog,
				componentProps: { pass, quote, seriesId: 'series-1', onClose: vi.fn() }
			}
		});
		await userEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
	}

	it('routes complete_questionnaire to the refusal event', async () => {
		refuse(400, {
			allowed: false,
			event_id: 'event-b',
			next_step: 'complete_questionnaire',
			questionnaires_missing: ['q-event']
		});
		await openAndBuy();

		const link = await screen.findByTestId('pass-questionnaire-link');
		expect(link.getAttribute('href')).toContain('/events/acme/finale/questionnaire/q-event');
		expect(screen.getByText('Finale vetting')).toBeInTheDocument();
		expect(eventpublicdetailsGetEvent).toHaveBeenCalledWith({ path: { event_id: 'event-b' } });
	});

	it('says the answers are being reviewed instead of a raw error', async () => {
		refuse(400, {
			allowed: false,
			event_id: 'event-a',
			reason_code: 'questionnaire_pending_review',
			next_step: 'wait_for_questionnaire_evaluation'
		});
		await openAndBuy();
		expect(await screen.findByRole('alert')).toHaveTextContent(/Your answers are being reviewed/);
	});

	it('shows the localized eligibility message for other refusals', async () => {
		refuse(400, {
			allowed: false,
			event_id: 'event-a',
			reason_code: 'members_excluded',
			next_step: 'choose_another_tier'
		});
		await openAndBuy();
		const alert = await screen.findByTestId('series-pass-eligibility-refusal');
		expect(alert.textContent?.trim().length).toBeGreaterThan(0);
	});

	it('handles a plain 403 with readable copy', async () => {
		refuse(403, { detail: 'Forbidden' });
		await openAndBuy();
		await waitFor(() => expect(seriespassCheckoutSeriesPass).toHaveBeenCalled());
		expect(screen.queryByTestId('pass-questionnaire-steps')).not.toBeInTheDocument();
	});
});
