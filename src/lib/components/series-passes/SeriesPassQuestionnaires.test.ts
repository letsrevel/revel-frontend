import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import { replaceState } from '$app/navigation';
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
import { seriesPassQueryKeys } from '$lib/queries/series-passes';

const pageUrl = vi.hoisted(() => ({ href: 'http://localhost/events/acme/series/season' }));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(pageUrl.href);
		},
		state: {}
	}
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
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
		pageUrl.href = 'http://localhost/events/acme/series/season';
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

describe('SeriesPassCard — returning from a questionnaire', () => {
	const missing = {
		questionnaires_missing: ['q-series'],
		questionnaire_event_id: 'event-a',
		questionnaire_events: [{ questionnaire_id: 'q-series', event_id: 'event-a' }]
	};
	beforeEach(() => {
		vi.clearAllMocks();
		pageUrl.href = 'http://localhost/events/acme/series/season?page=2';
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

	it('returns to the page as the SvelteKit page url, without the one-shot signal', async () => {
		pageUrl.href += '&questionnaire=done&qpass=pass-1';
		mockQuote(missing);
		renderCard();
		const link = await screen.findByTestId('pass-questionnaire-link');
		const returnUrl = new URL(link.getAttribute('href') ?? '', 'http://localhost').searchParams.get(
			'returnUrl'
		);
		// Tagged with the pass the flow came from, so only its card reacts on return.
		expect(returnUrl).toBe('/events/acme/series/season?page=2&qpass=pass-1');
	});

	it('shows the review notice, keeps Buy enabled and describes it, then strips the param', async () => {
		pageUrl.href += '&questionnaire=pending&qpass=pass-1';
		mockQuote();
		renderCard();
		const notice = await screen.findByTestId('pass-questionnaire-review-pending');
		expect(notice).toHaveTextContent(
			"Your answers are being reviewed. You can buy the pass once they're approved."
		);
		const buy = screen.getByRole('button', { name: 'Get season pass' });
		await waitFor(() => expect(buy).toBeEnabled());
		expect(buy).toHaveAccessibleDescription(/being reviewed/);
		await waitFor(() => expect(replaceState).toHaveBeenCalled());
		const stripped = vi.mocked(replaceState).mock.calls[0][0] as URL;
		expect(stripped.searchParams.has('questionnaire')).toBe(false);
		expect(stripped.searchParams.get('page')).toBe('2');
		expect(stripped.searchParams.has('qpass')).toBe(false);
	});

	it('shows the review notice and moves focus only on the card the signal names', async () => {
		const otherPass = { ...pass, id: 'pass-2', name: 'Winter pass' } as SeriesPassSchema;
		pageUrl.href += '&questionnaire=pending&qpass=pass-2';
		mockQuote();
		const first = render(QueryClientTestWrapper, {
			props: {
				client: newClient(),
				component: SeriesPassCard,
				componentProps: { pass, seriesId: 'series-1', isAuthenticated: true }
			}
		});
		const second = render(QueryClientTestWrapper, {
			props: {
				client: newClient(),
				component: SeriesPassCard,
				componentProps: { pass: otherPass, seriesId: 'series-1', isAuthenticated: true }
			}
		});

		const notices = await within(second.container).findAllByTestId(
			'pass-questionnaire-review-pending'
		);
		expect(notices).toHaveLength(1);
		expect(within(first.container).queryByTestId('pass-questionnaire-review-pending')).toBeNull();
		const buy = within(second.container).getByRole('button', { name: 'Get season pass' });
		await waitFor(() => expect(buy).toHaveFocus());
		expect(
			within(first.container).getByRole('button', { name: 'Get season pass' })
		).not.toHaveFocus();
	});

	it('ignores a signal aimed at another pass and still strips it', async () => {
		pageUrl.href += '&questionnaire=pending&qpass=some-other-pass';
		mockQuote();
		renderCard();
		const buy = await screen.findByRole('button', { name: 'Get season pass' });
		await waitFor(() => expect(replaceState).toHaveBeenCalled());
		expect(screen.queryByTestId('pass-questionnaire-review-pending')).not.toBeInTheDocument();
		expect(buy).not.toHaveFocus();
	});

	it('moves focus to the steps heading once the quote has loaded', async () => {
		pageUrl.href += '&questionnaire=done&qpass=pass-1';
		mockQuote(missing);
		renderCard();
		await screen.findByText('House rules');
		await waitFor(() =>
			expect(screen.getByText('Complete these questionnaires first').closest('h3')).toHaveFocus()
		);
	});

	it('moves focus to Buy when nothing is left to answer', async () => {
		pageUrl.href += '&questionnaire=done&qpass=pass-1';
		mockQuote();
		renderCard();
		const buy = await screen.findByRole('button', { name: 'Get season pass' });
		await waitFor(() => expect(buy).toHaveFocus());
	});

	it('does not steal focus on a normal page load', async () => {
		mockQuote(missing);
		renderCard();
		await screen.findByText('House rules');
		expect(document.body).toHaveFocus();
		expect(replaceState).not.toHaveBeenCalled();
	});
});

describe('Pass questionnaire lookups', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		pageUrl.href = 'http://localhost/events/acme/series/season';
		mockLookups();
	});

	it('fetches each event and each questionnaire once, however many rows share them', async () => {
		mockQuote({
			questionnaires_missing: ['q-series', 'q-event'],
			questionnaire_event_id: 'event-a',
			questionnaire_events: [
				{ questionnaire_id: 'q-series', event_id: 'event-a' },
				{ questionnaire_id: 'q-series', event_id: 'event-b' },
				{ questionnaire_id: 'q-event', event_id: 'event-b' }
			]
		});
		render(QueryClientTestWrapper, {
			props: {
				client: newClient(),
				component: SeriesPassCard,
				componentProps: { pass, seriesId: 'series-1', isAuthenticated: true }
			}
		});
		await waitFor(() => expect(screen.getAllByTestId('pass-questionnaire-link')).toHaveLength(3));
		expect(eventpublicdetailsGetEvent).toHaveBeenCalledTimes(2);
		expect(eventpublicattendanceGetQuestionnaire).toHaveBeenCalledTimes(2);
	});
});

describe('SeriesPassPurchaseDialog — checkout 400 fallback', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		pageUrl.href = 'http://localhost/events/acme/series/season';
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

	it('renders the steps from the refreshed quote, not from the 400 body', async () => {
		// The 400 names a single event (event-b); the refreshed quote routes a
		// mixed set across both events.
		mockQuote();
		refuse(400, {
			allowed: false,
			event_id: 'event-b',
			next_step: 'complete_questionnaire',
			questionnaires_missing: ['q-event']
		});
		render(QueryClientTestWrapper, {
			props: {
				client: newClient(),
				component: SeriesPassCard,
				componentProps: { pass, seriesId: 'series-1', isAuthenticated: true }
			}
		});
		await userEvent.click(await screen.findByRole('button', { name: 'Get season pass' }));
		const dialog = await screen.findByRole('dialog');
		// The checkout call is what reveals the missing questionnaires: from now on
		// the quote reports them.
		mockQuote({
			questionnaires_missing: ['q-series', 'q-event'],
			questionnaire_event_id: 'event-a',
			questionnaire_events: [
				{ questionnaire_id: 'q-series', event_id: 'event-a' },
				{ questionnaire_id: 'q-event', event_id: 'event-b' }
			]
		});
		await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }));

		await waitFor(() =>
			expect(within(dialog).getAllByTestId('pass-questionnaire-link')).toHaveLength(2)
		);
		const links = within(dialog).getAllByTestId('pass-questionnaire-link');
		expect(links[0].getAttribute('href')).toContain(
			'/events/acme/opening-night/questionnaire/q-series'
		);
		expect(links[1].getAttribute('href')).toContain('/events/acme/finale/questionnaire/q-event');
	});

	it('shows the steps the 400 routes across two events, at once, and refreshes the quote', async () => {
		refuse(400, {
			allowed: false,
			event_id: 'event-b',
			next_step: 'complete_questionnaire',
			questionnaires_missing: ['q-series', 'q-event'],
			questionnaire_events: [
				{ questionnaire_id: 'q-series', event_id: 'event-a' },
				{ questionnaire_id: 'q-event', event_id: 'event-b' }
			]
		});
		const client = newClient();
		const invalidate = vi.spyOn(client, 'invalidateQueries');
		render(QueryClientTestWrapper, {
			props: {
				client,
				component: SeriesPassPurchaseDialog,
				componentProps: { pass, quote, seriesId: 'series-1', onClose: vi.fn() }
			}
		});
		await userEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));

		await waitFor(() => expect(screen.getAllByTestId('pass-questionnaire-link')).toHaveLength(2));
		const links = screen.getAllByTestId('pass-questionnaire-link');
		expect(links[0].getAttribute('href')).toContain(
			'/events/acme/opening-night/questionnaire/q-series'
		);
		expect(links[1].getAttribute('href')).toContain('/events/acme/finale/questionnaire/q-event');
		expect(screen.queryByTestId('series-pass-questionnaires-still-needed')).not.toBeInTheDocument();
		expect(
			screen.queryByText('Checking which questionnaires you still need to answer…')
		).toBeNull();
		expect(invalidate).toHaveBeenCalledWith(
			expect.objectContaining({ queryKey: seriesPassQueryKeys.quote('series-1', 'pass-1') })
		);
	});

	it('falls back to a neutral message and the 400 event when the quote lists nothing', async () => {
		refuse(400, {
			allowed: false,
			event_id: 'event-b',
			next_step: 'complete_questionnaire',
			questionnaires_missing: ['q-event'],
			questionnaire_events: null
		});
		await openAndBuy();

		const note = await screen.findByTestId('series-pass-questionnaires-still-needed');
		expect(note).toHaveTextContent(
			'Some questionnaires still need your answers. Open the event page to complete them.'
		);
		const link = await screen.findByTestId('series-pass-questionnaires-event-link');
		expect(link.getAttribute('href')).toBe('/events/acme/finale');
		expect(screen.queryByTestId('pass-questionnaire-steps')).not.toBeInTheDocument();
		expect(eventpublicattendanceGetQuestionnaire).not.toHaveBeenCalled();
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

	it('says "You can\'t buy this pass." for a 403 without a detail', async () => {
		refuse(403, {});
		await openAndBuy();
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You can't buy this pass."));
		expect(screen.queryByTestId('pass-questionnaire-steps')).not.toBeInTheDocument();
	});

	it('surfaces the backend detail for a 403', async () => {
		refuse(403, { detail: 'You are blacklisted.' });
		await openAndBuy();
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You are blacklisted.'));
	});
});
