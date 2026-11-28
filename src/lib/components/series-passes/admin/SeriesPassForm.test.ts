import { render, screen, waitFor, fireEvent, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeriesPassForm from './SeriesPassForm.svelte';
import type {
	EventInListSchema,
	SeriesPassAdminSchema,
	TicketTierDetailSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api')>()),
	seriespassadminUpdateSeriesPass: vi.fn(),
	seriespassadminCreateSeriesPass: vi.fn(),
	eventadminticketsListTicketTiers: vi.fn()
}));
import { seriespassadminUpdateSeriesPass, eventadminticketsListTicketTiers } from '$lib/api';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const pass = {
	id: 'pass-1',
	name: 'Season',
	description: null,
	price: '30.00',
	pro_rata_discount: '0',
	currency: 'EUR',
	payment_method: 'online',
	purchasable_by: 'public',
	visibility: 'public',
	sales_start_at: null,
	sales_end_at: null,
	total_quantity: null,
	tier_links: [],
	holder_count: 0
} as unknown as SeriesPassAdminSchema;

function renderForm(p: SeriesPassAdminSchema = pass) {
	const onClose = vi.fn();
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({
				defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
			}),
			component: SeriesPassForm,
			componentProps: {
				seriesId: 'series-1',
				accessToken: 'tok',
				pass: p,
				upcomingEvents: [],
				onClose
			}
		}
	});
	return { onClose };
}

describe('SeriesPassForm — non-members rule and stricter-link 400 (#1172)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('offers "Non-members only" and documents that it blocks all active members', async () => {
		renderForm();
		const select = screen.getByLabelText('Who can buy');
		expect(screen.getByRole('option', { name: 'Non-members only' })).toBeInTheDocument();

		await userEvent.selectOptions(select, 'non_members');

		const help = screen.getByTestId('pass-non-members-help');
		expect(help).toHaveTextContent('Blocks every active member');
		expect(help).toHaveTextContent('no tier-level exclusion');
		expect(select.getAttribute('aria-describedby')).toContain('pass-non-members-help');
	});

	it('saves non_members as the new rule', async () => {
		vi.mocked(seriespassadminUpdateSeriesPass).mockResolvedValue({
			data: { ...pass, purchasable_by: 'non_members' },
			error: undefined,
			response: { ok: true, status: 200 } as Response
		} as never);
		const { onClose } = renderForm();

		await userEvent.selectOptions(screen.getByLabelText('Who can buy'), 'non_members');
		await userEvent.click(screen.getByRole('button', { name: /save/i }));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(vi.mocked(seriespassadminUpdateSeriesPass).mock.calls[0][0].body).toMatchObject({
			purchasable_by: 'non_members'
		});
	});

	it('shows the 400 for a rule change that would strand a link beside the select, once', async () => {
		const message =
			'A covered tier has a stricter purchase rule; change the tier or unlink it first.';
		vi.mocked(seriespassadminUpdateSeriesPass).mockResolvedValue({
			data: undefined,
			error: { errors: { purchasable_by: [message] } },
			response: { ok: false, status: 400 } as Response
		} as never);
		const { onClose } = renderForm();

		await userEvent.selectOptions(screen.getByLabelText('Who can buy'), 'non_members');
		await userEvent.click(screen.getByRole('button', { name: /save/i }));

		const inline = await screen.findByTestId('pass-purchasable-by-error');
		expect(inline).toHaveTextContent(message);
		expect(screen.getByLabelText('Who can buy').getAttribute('aria-describedby')).toContain(
			inline.id
		);
		// Not duplicated in the form-level alert, and the dialog stays open.
		expect(screen.getAllByText(message)).toHaveLength(1);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('still raises a non-field error at form level', async () => {
		vi.mocked(seriespassadminUpdateSeriesPass).mockResolvedValue({
			data: undefined,
			error: { detail: 'Something else went wrong.' },
			response: { ok: false, status: 400 } as Response
		} as never);
		renderForm();

		await userEvent.click(screen.getByRole('button', { name: /save/i }));

		expect(await screen.findByText('Something else went wrong.')).toBeInTheDocument();
	});

	it('edit mode: coverage-field errors have no inline slot, so they reach the form alert', async () => {
		vi.mocked(seriespassadminUpdateSeriesPass).mockResolvedValue({
			data: undefined,
			error: { errors: { tier: ['Tier is not valid for this pass.'] } },
			response: { ok: false, status: 400 } as Response
		} as never);
		renderForm();

		await userEvent.click(screen.getByRole('button', { name: /save/i }));

		expect(await screen.findByText(/Tier is not valid for this pass\./)).toBeInTheDocument();
	});
});

describe('SeriesPassForm — setting warnings (#1314)', () => {
	beforeEach(() => vi.clearAllMocks());

	const NOW = Date.parse('2027-01-01T00:00:00Z');
	const link = (id: string, event_start: string) => ({
		id,
		event_id: `e-${id}`,
		tier_id: `t-${id}`,
		event_start
	});
	const threeLinks = [
		link('1', '2027-02-01T18:00:00Z'),
		link('2', '2027-03-01T18:00:00Z'),
		link('3', '2027-04-01T18:00:00Z')
	];

	function renderWarnForm(props: Record<string, unknown>) {
		render(QueryClientTestWrapper, {
			props: {
				client: new QueryClient({
					defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
				}),
				component: SeriesPassForm,
				componentProps: {
					seriesId: 'series-1',
					accessToken: 'tok',
					upcomingEvents: [],
					now: NOW,
					onClose: vi.fn(),
					...props
				}
			}
		});
	}

	it('shows E1-order live while the sales dates are typed (edit)', async () => {
		renderWarnForm({ pass: { ...pass, tier_links: threeLinks } });
		const list = screen.getByTestId('series-pass-form-warnings');
		expect(within(list).queryByRole('list')).toBeNull();

		await fireEvent.input(screen.getByLabelText('Sales start'), {
			target: { value: '2027-01-10T10:00' }
		});
		await fireEvent.input(screen.getByLabelText('Sales end'), {
			target: { value: '2027-01-05T10:00' }
		});

		await waitFor(() =>
			expect(within(list).getByText('Sales end before they start')).toBeInTheDocument()
		);
		expect(within(list).getByRole('link', { name: /Change sales end/ })).toHaveAttribute(
			'href',
			'#pass-sales-end'
		);
	});

	it('shows E3 when the organization has no Stripe account', () => {
		renderWarnForm({
			pass: { ...pass, tier_links: threeLinks },
			organizationStripeConnected: false
		});
		const list = screen.getByTestId('series-pass-form-warnings');
		expect(within(list).getByText('Online payments are not set up')).toBeInTheDocument();
	});

	it('shows no warning for an inactive pass in edit mode', () => {
		renderWarnForm({
			pass: { ...pass, is_active: false, tier_links: threeLinks },
			organizationStripeConnected: false
		});
		const list = screen.getByTestId('series-pass-form-warnings');
		expect(within(list).queryByRole('list')).toBeNull();
		expect(screen.queryByText('Online payments are not set up')).toBeNull();
	});

	it('does not show E3 when the prop is not given', () => {
		renderWarnForm({ pass: { ...pass, tier_links: threeLinks } });
		expect(screen.queryByText('Online payments are not set up')).toBeNull();
	});

	it('shows E4b in create mode once the selected tiers are loaded', async () => {
		const events = ['a', 'b'].map((id, i) => ({
			id: `evt-${id}`,
			name: `Week ${id}`,
			start: `2027-0${i + 2}-01T18:00:00Z`
		})) as unknown as EventInListSchema[];
		vi.mocked(eventadminticketsListTicketTiers).mockResolvedValue({
			data: {
				results: [
					{
						id: 'tier-x',
						name: 'GA',
						price: '10.00',
						currency: 'EUR',
						seat_assignment_mode: 'none',
						price_type: 'fixed',
						purchasable_by: 'public',
						restricted_to_membership_tiers: []
					} as unknown as TicketTierDetailSchema
				]
			},
			error: undefined,
			response: { ok: true } as Response
		} as never);
		renderWarnForm({ pass: null, upcomingEvents: events });
		const list = screen.getByTestId('series-pass-form-warnings');

		await fireEvent.input(screen.getByLabelText(/^Price/), { target: { value: '50' } });

		await waitFor(() =>
			expect(within(list).getByText('Pass costs more than the tickets')).toBeInTheDocument()
		);
		// Create mode: unsaved, so Info warnings carry no dismiss button.
		expect(within(list).queryByRole('button', { name: /Dismiss/ })).toBeNull();
	});
});
