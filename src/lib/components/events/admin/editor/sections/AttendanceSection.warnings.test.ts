import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import AttendanceSection from './AttendanceSection.svelte';

function renderWith(componentProps: Record<string, unknown>) {
	return render(QueryClientTestWrapper, {
		props: { client: new QueryClient(), component: AttendanceSection, componentProps }
	});
}

describe('AttendanceSection admin warnings', () => {
	it('"Clear deadline" empties rsvp_before on a ticketed event', async () => {
		const onUpdate = vi.fn();
		renderWith({
			formData: { requires_ticket: true, rsvp_before: '2030-01-01T10:00' },
			selectedVenue: null,
			isEditMode: true,
			onUpdate,
			eventId: 'evt-1'
		});
		expect(document.querySelector('[data-warning-id="C2-rsvp-ticketed"]')).not.toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Clear deadline' }));
		expect(onUpdate).toHaveBeenCalledWith({ rsvp_before: '' });
	});

	it('shows no deadline warning on a ticketed event without a deadline', () => {
		renderWith({
			formData: { requires_ticket: true },
			selectedVenue: null,
			isEditMode: true,
			onUpdate: vi.fn()
		});
		expect(document.querySelector('[data-warning-id="C2-rsvp-ticketed"]')).toBeNull();
	});
});
