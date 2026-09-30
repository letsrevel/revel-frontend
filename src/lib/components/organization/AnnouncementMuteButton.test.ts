import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import AnnouncementMuteButton from './AnnouncementMuteButton.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	notificationpreferenceGetPreferences: vi.fn(),
	notificationpreferenceMuteOrganization: vi.fn(),
	notificationpreferenceUnmuteOrganization: vi.fn(),
	organizationGetOrganizationById: vi.fn(),
	organizationGetFollowStatus: vi.fn(),
	eventseriesGetFollowStatus: vi.fn()
}));

const authState = vi.hoisted(() => ({ accessToken: 'tok' as string | null }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: authState }));

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
	notificationpreferenceGetPreferences,
	notificationpreferenceMuteOrganization,
	notificationpreferenceUnmuteOrganization,
	organizationGetFollowStatus
} from '$lib/api/generated/sdk.gen';
import { toast } from 'svelte-sonner';

const organization = { id: 'org-1', slug: 'acme', name: 'Acme' };

function setup({ muted = false, following = false } = {}) {
	vi.mocked(notificationpreferenceGetPreferences).mockResolvedValue({
		data: { muted_organization_ids: muted ? ['org-1'] : [] }
	} as never);
	vi.mocked(organizationGetFollowStatus).mockResolvedValue({
		data: { is_following: following, follow: null }
	} as never);
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: AnnouncementMuteButton,
			componentProps: { organization }
		}
	});
}

describe('AnnouncementMuteButton (#984)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authState.accessToken = 'tok';
	});

	it('mutes for a signed-in non-follower and says what still arrives', async () => {
		const user = userEvent.setup();
		setup();
		vi.mocked(notificationpreferenceMuteOrganization).mockResolvedValue({
			data: { muted_organization_ids: ['org-1'] }
		} as never);

		await user.click(await screen.findByRole('button', { name: 'Mute announcements' }));

		expect(notificationpreferenceMuteOrganization).toHaveBeenCalledWith(
			expect.objectContaining({ path: { organization_id: 'org-1' } })
		);
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith(
				expect.stringMatching(/tickets, receipts and event cancellations/i)
			)
		);
		// The label flips from the mutation's returned preferences
		expect(await screen.findByRole('button', { name: 'Unmute announcements' })).toBeInTheDocument();
	});

	it('unmutes when already muted', async () => {
		const user = userEvent.setup();
		setup({ muted: true });
		vi.mocked(notificationpreferenceUnmuteOrganization).mockResolvedValue({
			data: { muted_organization_ids: [] }
		} as never);

		await user.click(await screen.findByRole('button', { name: 'Unmute announcements' }));
		expect(notificationpreferenceUnmuteOrganization).toHaveBeenCalledOnce();
	});

	it('stays hidden for followers (their follow menu owns the same toggle)', async () => {
		setup({ following: true });
		await waitFor(() => expect(organizationGetFollowStatus).toHaveBeenCalled());
		await new Promise((r) => setTimeout(r, 0));
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('renders nothing when signed out', () => {
		authState.accessToken = null;
		setup();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
		expect(notificationpreferenceGetPreferences).not.toHaveBeenCalled();
	});

	it('reports a failed write', async () => {
		const user = userEvent.setup();
		setup();
		vi.mocked(notificationpreferenceMuteOrganization).mockResolvedValue({
			error: { detail: 'boom' }
		} as never);
		await user.click(await screen.findByRole('button', { name: 'Mute announcements' }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
	});
});
