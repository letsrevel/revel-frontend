import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import InvitationRequestCard from './InvitationRequestCard.svelte';
import { toast } from 'svelte-sonner';
import type { EventInvitationRequestSchema } from '$lib/api/generated/types.gen';
import { eventpublicdiscoveryDeleteInvitationRequest } from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventpublicdiscoveryDeleteInvitationRequest: vi.fn()
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type DeleteResult = Awaited<ReturnType<typeof eventpublicdiscoveryDeleteInvitationRequest>>;

const request = {
	id: 'req1',
	status: 'pending',
	message: '',
	created_at: '2026-09-01T10:00:00Z',
	event: {
		id: 'e1',
		name: 'Autumn Market',
		start: '2026-10-01T18:00:00Z',
		logo: null,
		logo_thumbnail_url: null
	}
} as unknown as EventInvitationRequestSchema;

function renderCard() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: InvitationRequestCard,
			componentProps: { request }
		}
	});
}

describe('InvitationRequestCard cancel error handling', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('confirm', () => true);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('toasts an error and no success when cancelling the request fails', async () => {
		vi.mocked(eventpublicdiscoveryDeleteInvitationRequest).mockResolvedValue({
			data: undefined,
			error: { detail: 'Nope' },
			response: { ok: false, status: 400 } as Response
		} as unknown as DeleteResult);
		const user = userEvent.setup();
		renderCard();

		await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(toast.success).not.toHaveBeenCalled();
	});
});
