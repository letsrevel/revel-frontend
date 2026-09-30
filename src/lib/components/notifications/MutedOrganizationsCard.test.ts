import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import MutedOrganizationsCard from './MutedOrganizationsCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	notificationpreferenceGetPreferences: vi.fn(),
	notificationpreferenceMuteOrganization: vi.fn(),
	notificationpreferenceUnmuteOrganization: vi.fn(),
	organizationGetOrganizationById: vi.fn()
}));

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
	notificationpreferenceGetPreferences,
	notificationpreferenceUnmuteOrganization,
	organizationGetOrganizationById
} from '$lib/api/generated/sdk.gen';

const prefs = (muted: string[]) =>
	({ muted_organization_ids: muted }) as unknown as NotificationPreferenceSchema;

function renderCard(muted: string[]) {
	vi.mocked(notificationpreferenceGetPreferences).mockResolvedValue({
		data: prefs(muted)
	} as never);
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } }),
			component: MutedOrganizationsCard,
			componentProps: { authToken: 'tok', initialPreferences: prefs(muted) }
		}
	});
}

describe('MutedOrganizationsCard (#984)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(organizationGetOrganizationById).mockImplementation((async ({
			path
		}: {
			path: { organization_id: string };
		}) =>
			path.organization_id === 'o1'
				? { data: { id: 'o1', name: 'Acme', slug: 'acme' } }
				: { error: { detail: 'Not found' } }) as never);
	});

	it('explains what muting leaves untouched', () => {
		renderCard([]);
		expect(screen.getByRole('heading', { name: 'Muted organizations' })).toBeInTheDocument();
		expect(screen.getByText(/tickets, receipts and event cancellations/i)).toBeInTheDocument();
	});

	it('shows an empty state when nothing is muted', () => {
		renderCard([]);
		expect(screen.getByText('No muted organizations')).toBeInTheDocument();
		expect(screen.queryByRole('list')).not.toBeInTheDocument();
	});

	it('lists muted organizations with links, and a fallback for unresolvable ones', async () => {
		renderCard(['o1', 'gone']);
		expect(await screen.findByRole('link', { name: 'Acme' })).toHaveAttribute('href', '/org/acme');
		expect(await screen.findByText('Organization no longer available')).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: 'Unmute announcements from Organization no longer available'
			})
		).toBeInTheDocument();
	});

	it('unmutes an organization and drops it from the list', async () => {
		const user = userEvent.setup();
		renderCard(['o1']);
		vi.mocked(notificationpreferenceUnmuteOrganization).mockResolvedValue({
			data: prefs([])
		} as never);

		const row = (await screen.findByRole('link', { name: 'Acme' })).closest('li');
		if (!row) throw new Error('row not found');
		await user.click(within(row).getByRole('button', { name: 'Unmute announcements from Acme' }));

		expect(notificationpreferenceUnmuteOrganization).toHaveBeenCalledWith(
			expect.objectContaining({ path: { organization_id: 'o1' } })
		);
		await waitFor(() => expect(screen.getByText('No muted organizations')).toBeInTheDocument());
	});
});
