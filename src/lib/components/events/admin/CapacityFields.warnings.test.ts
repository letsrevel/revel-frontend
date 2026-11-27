import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { VenueDetailSchema } from '$lib/api/generated/types.gen';
import CapacityFields from './CapacityFields.svelte';

function renderWith(componentProps: Record<string, unknown>) {
	return render(QueryClientTestWrapper, {
		props: { client: new QueryClient(), component: CapacityFields, componentProps }
	});
}

const venue = { id: 'v1', capacity: 100 } as VenueDetailSchema;

describe('CapacityFields admin warnings', () => {
	const warnIn = (id: string) => document.querySelector(`[data-warning-id="${id}"]`);

	it('C1: warns when the waitlist is open without any capacity', () => {
		renderWith({ formData: { waitlist_open: true }, selectedVenue: null, onUpdate: vi.fn() });
		expect(warnIn('C1')).toHaveTextContent('The waitlist cannot be joined');
		expect(screen.getByRole('link', { name: 'Set attendee limit' })).toHaveAttribute(
			'href',
			'#max-attendees'
		);
	});

	it('C1: stays quiet when the venue sets a capacity', () => {
		renderWith({ formData: { waitlist_open: true }, selectedVenue: venue, onUpdate: vi.fn() });
		expect(warnIn('C1')).toBeNull();
	});

	it('C3b: shows the callout and drops the old hand-rolled warning paragraph', () => {
		renderWith({ formData: { max_attendees: 150 }, selectedVenue: venue, onUpdate: vi.fn() });
		expect(warnIn('C3b')).toHaveTextContent('Limit is above the venue capacity');
		expect(document.body.textContent).not.toContain('⚠️');
		// Only the new callout mentions the numbers: no second box.
		expect(screen.getAllByText(/150/)).toHaveLength(1);
	});
});
