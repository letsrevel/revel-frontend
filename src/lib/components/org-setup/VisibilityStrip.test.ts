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
		await waitFor(() => expect(screen.getByRole('status').textContent).toContain('/org/acme'));
		const arg = vi.mocked(organizationadmincoreUpdateOrganization).mock.calls[0][0];
		expect(arg.path).toEqual({ slug: 'acme' });
		expect(arg.body).toEqual({ visibility: 'public' });
		expect(invalidateAll).toHaveBeenCalled();
		expect(screen.getByRole('status').textContent).toContain('/org/acme');
	});

	it('keeps one live region mounted from the start, empty until the flip succeeds', () => {
		setup('private');
		const region = screen.getByRole('status');
		expect(region.getAttribute('aria-live')).toBe('polite');
		expect(region.textContent?.trim()).toBe('');
	});

	it('status region is a visually hidden polite live region carrying only the success sentence', async () => {
		vi.mocked(organizationadmincoreUpdateOrganization).mockResolvedValue({ data: {} } as never);
		const user = userEvent.setup();
		setup('private');
		const region = screen.getByRole('status');
		expect(region.classList.contains('sr-only')).toBe(true);
		await user.click(screen.getByRole('button', { name: 'Make page public' }));
		await waitFor(() => expect(region.textContent).toContain('/org/acme'));
		expect(region.textContent).not.toContain('Undo');
		expect(region.contains(screen.getByRole('button', { name: 'Undo' }))).toBe(false);
	});

	it('success line: lead is aria-hidden (status region carries the sentence); URL is a real link without protocol', async () => {
		vi.mocked(organizationadmincoreUpdateOrganization).mockResolvedValue({ data: {} } as never);
		const user = userEvent.setup();
		const { container } = setup('private');
		await user.click(screen.getByRole('button', { name: 'Make page public' }));
		await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy());
		const link = container.querySelector('a') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe(`${window.location.origin}/org/acme`);
		expect(link.textContent).toBe(`${window.location.host}/org/acme`);
		expect(link.closest('[aria-hidden="true"]')).toBeNull();
		expect(container.querySelector('span[aria-hidden="true"]')?.textContent).toContain(
			'Your page is public:'
		);
		expect(screen.getByRole('button', { name: 'Undo' }).closest('[aria-hidden="true"]')).toBeNull();
	});

	it('Make page public is an outline button (secondary to Create event)', () => {
		setup('private');
		const btn = screen.getByRole('button', { name: 'Make page public' });
		expect(btn.className).toContain('border-input');
		expect(btn.className).not.toContain('bg-primary ');
	});

	it('moves focus to Undo after Make public, and back to Make public after Undo', async () => {
		vi.mocked(organizationadmincoreUpdateOrganization).mockResolvedValue({ data: {} } as never);
		const user = userEvent.setup();
		setup('private');
		await user.click(screen.getByRole('button', { name: 'Make page public' }));
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo' }))
		);
		await user.click(screen.getByRole('button', { name: 'Undo' }));
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Make page public' }))
		);
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
		expect(screen.getByRole('status').textContent?.trim()).toBe('');
		expect(screen.getByRole('alert').textContent).toContain("Couldn't update visibility");
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
		await waitFor(() => expect(screen.getByRole('status').textContent?.trim()).toBe(''));
	});
});
