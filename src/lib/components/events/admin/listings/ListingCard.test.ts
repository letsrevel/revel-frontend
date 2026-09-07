import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import ListingCard from './ListingCard.svelte';
import type { EventLinkSchema, EventListingSchema } from '$lib/api/generated/types.gen';
import {
	eventintegrationsPublish,
	eventintegrationsPush,
	eventintegrationsUpdate
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventintegrationsPush: vi.fn(),
	eventintegrationsPublish: vi.fn(),
	eventintegrationsUpdate: vi.fn()
}));

type PushResult = Awaited<ReturnType<typeof eventintegrationsPush>>;
type PublishResult = Awaited<ReturnType<typeof eventintegrationsPublish>>;
type UpdateResult = Awaited<ReturnType<typeof eventintegrationsUpdate>>;

function link(overrides: Partial<EventLinkSchema> = {}): EventLinkSchema {
	return {
		provider: 'eventbrite',
		display_name: 'Eventbrite',
		remote_id: 'ev-1',
		remote_url: 'https://www.eventbrite.com/e/ev-1',
		remote_status: 'draft',
		sync_state: 'in_sync',
		origin: 'pushed',
		auto_sync: null,
		effective_auto_sync: true,
		last_pushed_at: '2026-09-07T10:00:00Z',
		sync_report: [],
		tiers: [],
		...overrides
	};
}

function listing(overrides: Partial<EventListingSchema> = {}): EventListingSchema {
	return {
		provider: 'eventbrite',
		display_name: 'Eventbrite',
		connection_status: 'active',
		link: null,
		...overrides
	};
}

const eligibleEvent = {
	event_type: 'public' as const,
	end: '2026-10-01T20:00:00Z',
	requires_ticket: true
};

function renderCard(
	l: EventListingSchema,
	opts: { isOwner?: boolean; pendingSlow?: boolean; event?: typeof eligibleEvent } = {}
) {
	const onChanged = vi.fn();
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: ListingCard,
			componentProps: {
				organizationSlug: 'acme',
				eventId: 'event-1',
				listing: l,
				event: opts.event ?? eligibleEvent,
				isOwner: opts.isOwner ?? true,
				pendingSlow: opts.pendingSlow ?? false,
				onChanged
			}
		}
	});
	return { onChanged };
}

function ok<T>(data: T) {
	return { data, error: undefined, response: { ok: true } as Response };
}

describe('ListingCard', () => {
	beforeEach(() => {
		vi.mocked(eventintegrationsPush).mockResolvedValue(
			ok(link({ sync_state: 'pending' })) as unknown as PushResult
		);
		vi.mocked(eventintegrationsPublish).mockResolvedValue(
			ok(link({ remote_status: 'live' })) as unknown as PublishResult
		);
		vi.mocked(eventintegrationsUpdate).mockResolvedValue(
			ok(link({ auto_sync: true })) as unknown as UpdateResult
		);
	});

	it('explains why an ineligible event cannot be listed and disables the button', () => {
		renderCard(listing(), { event: { event_type: 'private', end: '', requires_ticket: true } });
		expect(screen.getByText(/cannot be listed on Eventbrite yet/)).toBeInTheDocument();
		expect(screen.getByText('Only public events can be listed on Eventbrite.')).toBeInTheDocument();
		expect(screen.getByText('Add an end time before listing on Eventbrite.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Create Eventbrite draft' })).toBeDisabled();
	});

	it('creates the draft for an eligible event and reports the change', async () => {
		const user = userEvent.setup();
		const { onChanged } = renderCard(listing());
		expect(screen.getByText('Not listed on Eventbrite yet')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Create Eventbrite draft' }));
		await waitFor(() =>
			expect(vi.mocked(eventintegrationsPush)).toHaveBeenCalledWith(
				expect.objectContaining({ path: { event_id: 'event-1', provider: 'eventbrite' } })
			)
		);
		await waitFor(() => expect(onChanged).toHaveBeenCalled());
	});

	it('offers Publish on a draft, confirms, then publishes', async () => {
		const user = userEvent.setup();
		const { onChanged } = renderCard(listing({ link: link() }));
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Draft on Eventbrite');
		await user.click(screen.getByRole('button', { name: 'Publish on Eventbrite' }));
		const dialog = screen.getByRole('dialog', { name: 'Publish on Eventbrite?' });
		expect(dialog).toHaveTextContent('only cancelled');
		await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
		await waitFor(() => expect(vi.mocked(eventintegrationsPublish)).toHaveBeenCalled());
		await waitFor(() => expect(onChanged).toHaveBeenCalled());
	});

	it('shows Update and View on a live listing, without Publish', () => {
		renderCard(listing({ link: link({ remote_status: 'live' }) }));
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Live on Eventbrite');
		expect(screen.getByRole('button', { name: 'Update listing' })).toBeEnabled();
		expect(screen.getByRole('link', { name: 'View on Eventbrite' })).toHaveAttribute(
			'href',
			'https://www.eventbrite.com/e/ev-1'
		);
		expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
	});

	it('shows the sending state, and the slow copy after ten minutes', () => {
		renderCard(listing({ link: link({ sync_state: 'pending' }) }), { pendingSlow: true });
		expect(screen.getByText('Sending to Eventbrite…')).toBeInTheDocument();
		expect(screen.getByText(/taking longer than usual/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Update listing' })).toBeNull();
	});

	it('groups the report and offers Try again after a failure', () => {
		renderCard(
			listing({
				link: link({
					sync_state: 'failed',
					sync_report: [
						{
							scope: 'event',
							code: 'provider_rejected',
							detail: 'x',
							provider_message: 'Venue required'
						},
						{ scope: 'tier', tier_id: 't1', tier_name: 'VIP', code: 'tier_seated', detail: 'x' },
						{ scope: 'event', code: 'image_missing', detail: 'x' }
					]
				})
			})
		);
		expect(screen.getByRole('heading', { name: 'Problems' })).toBeInTheDocument();
		expect(screen.getByText('Eventbrite refused the change.')).toBeInTheDocument();
		expect(screen.getByText('Venue required')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Not sent to Eventbrite' })).toBeInTheDocument();
		expect(screen.getByText('VIP')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
	});

	it('offers Create it again when the listing was removed remotely', () => {
		renderCard(listing({ link: link({ sync_state: 'broken', remote_id: '', remote_url: '' }) }));
		expect(screen.getByText(/no longer exists on Eventbrite/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Create it again' })).toBeEnabled();
		expect(screen.queryByRole('link', { name: 'View on Eventbrite' })).toBeNull();
	});

	it('sends the owner to Integrations when not connected, and tells staff to ask', () => {
		renderCard(listing({ connection_status: null }), { isOwner: true });
		expect(screen.getByRole('link', { name: 'Connect it under Integrations' })).toHaveAttribute(
			'href',
			'/org/acme/admin/integrations'
		);
		renderCard(listing({ connection_status: null }), { isOwner: false });
		expect(screen.getByText(/Ask an organization owner to connect Eventbrite/)).toBeInTheDocument();
	});

	it('labels the inherit option with the organization default when no override is set', () => {
		renderCard(listing({ link: link({ auto_sync: null, effective_auto_sync: true }) }));
		const select = screen.getByRole('combobox', { name: 'Automatic updates' }) as HTMLSelectElement;
		expect(select.value).toBe('inherit');
		expect(select.options[0].textContent).toContain('currently on');
	});

	it('sends the auto-sync override', async () => {
		const user = userEvent.setup();
		const { onChanged } = renderCard(listing({ link: link() }));
		await user.selectOptions(screen.getByRole('combobox', { name: 'Automatic updates' }), 'on');
		await waitFor(() =>
			expect(vi.mocked(eventintegrationsUpdate)).toHaveBeenCalledWith(
				expect.objectContaining({ body: { auto_sync: true } })
			)
		);
		await waitFor(() => expect(onChanged).toHaveBeenCalled());
	});
});
