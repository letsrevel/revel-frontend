import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import AttendeeList from './AttendeeList.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	eventpublicdetailsGetEventAttendees,
	eventpublicdetailsGetPronounDistribution
} from '$lib/api';

vi.mock('$lib/api', () => ({
	eventpublicdetailsGetEventAttendees: vi.fn(),
	eventpublicdetailsGetPronounDistribution: vi.fn()
}));

function mockAttendees(displayNames: string[]) {
	vi.mocked(eventpublicdetailsGetEventAttendees).mockResolvedValue({
		data: { results: displayNames.map((display_name) => ({ display_name })), next: null }
	} as unknown as ReturnType<typeof eventpublicdetailsGetEventAttendees>);
}

function renderList(props: Record<string, unknown>) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(QueryClientTestWrapper, {
		props: { client, component: AttendeeList, componentProps: { eventId: 'e1', ...props } }
	});
}

describe('AttendeeList — guest-list disclosure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(eventpublicdetailsGetPronounDistribution).mockResolvedValue({
			data: {}
		} as unknown as ReturnType<typeof eventpublicdetailsGetPronounDistribution>);
	});

	it('renders the attendees when the guest list is disclosed', async () => {
		mockAttendees(['Ada Lovelace']);

		renderList({ totalAttendees: 1, isAuthenticated: true, listDisclosed: true });

		await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
	});

	// #690: `visibility_settings.show_attendee_list === false`. The backend
	// already serves an empty page; skipping the request keeps the "hidden" copy
	// from arriving behind a spinner.
	it('shows the hidden-list copy and never queries when the guest list is withheld', async () => {
		mockAttendees(['Ada Lovelace']);

		renderList({ totalAttendees: null, isAuthenticated: true, listDisclosed: false });

		expect(await screen.findByText(/hidden/i)).toBeInTheDocument();
		expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
		expect(eventpublicdetailsGetEventAttendees).not.toHaveBeenCalled();
	});

	it('defaults to disclosed when the caller does not say', async () => {
		mockAttendees(['Ada Lovelace']);

		renderList({ totalAttendees: 1, isAuthenticated: true });

		await waitFor(() => expect(eventpublicdetailsGetEventAttendees).toHaveBeenCalled());
	});
});
