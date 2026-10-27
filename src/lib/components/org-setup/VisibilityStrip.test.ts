import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import VisibilityStrip from './VisibilityStrip.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreUpdateOrganization: vi.fn()
}));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn().mockResolvedValue(undefined) }));
import { organizationadmincoreUpdateOrganization } from '$lib/api/generated/sdk.gen';
import { invalidateAll } from '$app/navigation';

function setup(visibility: string) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: VisibilityStrip,
			componentProps: { orgSlug: 'acme', visibility, accessToken: 'tok' }
		}
	});
}

describe('VisibilityStrip', () => {
	beforeEach(() => vi.clearAllMocks());

	it('shows for private', () => {
		setup('private');
		expect(screen.getByText('Your organization page is hidden')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Make page public' })).toBeTruthy();
	});

	it('renders nothing for members-only', () => {
		const { container } = setup('members-only');
		expect(screen.queryByText('Your organization page is hidden')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
		expect(container.textContent?.trim()).toBe('');
	});

	it('click sends only visibility, shows status line', async () => {
		vi.mocked(organizationadmincoreUpdateOrganization).mockResolvedValue({ data: {} } as never);
		const user = userEvent.setup();
		setup('private');
		await user.click(screen.getByRole('button', { name: 'Make page public' }));
		await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
		const arg = vi.mocked(organizationadmincoreUpdateOrganization).mock.calls[0][0];
		expect(arg.path).toEqual({ slug: 'acme' });
		expect(arg.body).toEqual({ visibility: 'public' });
		expect(invalidateAll).toHaveBeenCalled();
		expect(screen.getByRole('status').textContent).toContain('/org/acme');
	});

	it('error shows alert and re-enables button', async () => {
		vi.mocked(organizationadmincoreUpdateOrganization).mockResolvedValue({
			error: { detail: 'nope' }
		} as never);
		const user = userEvent.setup();
		setup('private');
		await user.click(screen.getByRole('button', { name: 'Make page public' }));
		await waitFor(() =>
			expect(screen.getByRole('alert').textContent).toContain("Couldn't update visibility")
		);
		await waitFor(() =>
			expect(
				(screen.getByRole('button', { name: 'Make page public' }) as HTMLButtonElement).disabled
			).toBe(false)
		);
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('undo sends the previous visibility', async () => {
		vi.mocked(organizationadmincoreUpdateOrganization).mockResolvedValue({ data: {} } as never);
		const user = userEvent.setup();
		setup('private');
		await user.click(screen.getByRole('button', { name: 'Make page public' }));
		await waitFor(() => screen.getByRole('status'));
		await user.click(screen.getByRole('button', { name: 'Undo' }));
		await waitFor(() => expect(organizationadmincoreUpdateOrganization).toHaveBeenCalledTimes(2));
		expect(vi.mocked(organizationadmincoreUpdateOrganization).mock.calls[1][0].body).toEqual({
			visibility: 'private'
		});
		await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
	});
});
