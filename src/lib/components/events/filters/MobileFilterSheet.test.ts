import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import MobileFilterSheet from './MobileFilterSheet.svelte';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { EventFilters as FilterState } from '$lib/utils/filters';

// Keep the tag list, the city name and the organization search off the network.
const { tagListTags } = vi.hoisted(() => ({ tagListTags: vi.fn() }));
vi.mock('$lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api')>()),
	tagListTags,
	cityGetCity: vi.fn().mockResolvedValue({ data: { id: 123, name: 'Vienna', country: 'Austria' } }),
	organizationListOrganizations: vi.fn().mockResolvedValue({ data: { results: [] } })
}));

function renderSheet(filters: FilterState, onUpdateFilters: (u: Partial<FilterState>) => void) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: MobileFilterSheet,
			componentProps: {
				filters,
				totalCount: 42,
				isOpen: true,
				onUpdateFilters,
				onClearFilters: vi.fn(),
				onClose: vi.fn()
			}
		}
	});
}

describe('MobileFilterSheet tag toggle', () => {
	beforeEach(() => {
		tagListTags.mockReset().mockResolvedValue({ data: { results: [] } });
	});

	const baseFilters: FilterState = {
		orderBy: 'start',
		page: 1,
		pageSize: 20
	} as FilterState;

	it('removes a selected tag when the chip letter case differs', async () => {
		tagListTags.mockResolvedValue({ data: { results: [{ name: 'Fun' }] } });
		const user = userEvent.setup();
		const onUpdateFilters = vi.fn();

		renderSheet({ ...baseFilters, tags: ['fun'] }, onUpdateFilters);

		const chip = await screen.findByRole('button', { name: /Remove Fun filter/ });
		expect(chip).toHaveAttribute('aria-pressed', 'true');
		await user.click(chip);

		expect(onUpdateFilters).toHaveBeenCalledTimes(1);
		expect(onUpdateFilters).toHaveBeenCalledWith({ tags: undefined });
	});

	it('appends a tag that is not selected', async () => {
		tagListTags.mockResolvedValue({ data: { results: [{ name: 'Fun' }, { name: 'Music' }] } });
		const user = userEvent.setup();
		const onUpdateFilters = vi.fn();

		renderSheet({ ...baseFilters, tags: ['fun'] }, onUpdateFilters);

		const chip = await screen.findByRole('button', { name: /Add Music filter/ });
		expect(chip).toHaveAttribute('aria-pressed', 'false');
		await user.click(chip);

		expect(onUpdateFilters).toHaveBeenCalledWith({ tags: ['fun', 'Music'] });
	});
});
