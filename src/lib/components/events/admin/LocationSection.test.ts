import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import LocationSection from './LocationSection.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import * as m from '$lib/paraglide/messages.js';
import type { VenueDetailSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminvenuesListVenues: vi.fn().mockResolvedValue({ data: { results: [] } })
}));

const venue = {
	id: 'venue_1',
	name: 'The Hall',
	address: '1 Public St',
	city: { id: 1, name: 'Rome', country: 'Italy' }
} as unknown as VenueDetailSchema;

function setup(formData: Record<string, unknown>, selectedVenue: VenueDetailSchema | null = null) {
	const onUpdate = vi.fn();
	const onVenueSelect = vi.fn();
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: LocationSection,
			componentProps: {
				formData,
				selectedCity: null,
				selectedVenue,
				organizationSlug: 'acme',
				validationErrors: {},
				onUpdate,
				onCitySelect: vi.fn(),
				onVenueSelect
			}
		}
	});
	return { onUpdate, onVenueSelect };
}

describe('LocationSection venue visibility copy (#1254)', () => {
	it('says venue addresses are public and offers a custom address when a venue is selected', () => {
		setup({ venue_id: 'venue_1', address: venue.address }, venue);

		expect(screen.getByText(m['locationSection.venuePublicNote']())).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: m['locationSection.useCustomAddressInstead']() })
		).toBeInTheDocument();
		// The event address visibility select is not offered in venue mode
		expect(screen.queryByLabelText(m['locationSection.addressVisibility']())).toBeNull();
	});

	it('switches to custom-address mode from the note', async () => {
		const user = userEvent.setup();
		const { onVenueSelect } = setup({ venue_id: 'venue_1', address: venue.address }, venue);

		await user.click(
			screen.getByRole('button', { name: m['locationSection.useCustomAddressInstead']() })
		);

		expect(onVenueSelect).toHaveBeenCalledWith(null);
		expect(screen.queryByText(m['locationSection.venuePublicNote']())).toBeNull();
		expect(screen.getByLabelText(m['locationSection.addressVisibility']())).toBeInTheDocument();
	});

	it('shows the reworded hint, without "private venues", in address mode', () => {
		setup({ address: '5 Secret Rd' });

		const hint = m['detailsStep.addressVisibilityHint']();
		expect(screen.getByText(hint)).toBeInTheDocument();
		expect(hint).not.toMatch(/private venues/i);
		expect(screen.queryByText(m['locationSection.venuePublicNote']())).toBeNull();
	});
});
