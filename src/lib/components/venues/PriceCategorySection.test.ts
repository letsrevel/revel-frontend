import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import PriceCategorySection from './PriceCategorySection.svelte';
import {
	organizationadminvenuesListPriceCategories,
	organizationadminvenuesCreatePriceCategory,
	organizationadminvenuesUpdatePriceCategory,
	organizationadminvenuesDeletePriceCategory
} from '$lib/api/generated/sdk.gen';
import { toast } from 'svelte-sonner';
import type { PriceCategorySchema } from '$lib/api/generated/types.gen';

// The section (and the modal it hosts) transitively imports exactly these four
// price-category ops; the module factory must stub them all. Real compiled
// paraglide messages back the accessible-name assertions.
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminvenuesListPriceCategories: vi.fn(),
	organizationadminvenuesCreatePriceCategory: vi.fn(),
	organizationadminvenuesUpdatePriceCategory: vi.fn(),
	organizationadminvenuesDeletePriceCategory: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

vi.mock('svelte-sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() }
}));

/** Typed helper over the generated ops' {data, error, response} envelope. */
function mockResult<T extends (...args: never[]) => unknown>(
	op: T,
	result: { data?: unknown; error?: unknown; status?: number }
) {
	// Success envelopes use `error: undefined` (never null) — the components
	// gate on `response.error` truthiness.
	vi.mocked(op).mockResolvedValue({
		data: result.data,
		error: result.error,
		response: { status: result.status ?? (result.error === undefined ? 200 : 400) }
	} as never);
}

const gold: PriceCategorySchema = {
	id: 'pc-gold',
	name: 'Gold',
	color: '#f9b233',
	display_order: 1
};
const silver: PriceCategorySchema = {
	id: 'pc-silver',
	name: 'Silver',
	color: '#9ab2ff',
	display_order: 0
};

function renderSection(props: { organizationSlug?: string; venueId?: string } = {}) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(QueryClientTestWrapper, {
		props: {
			client,
			component: PriceCategorySection,
			props: {
				organizationSlug: 'test-org',
				venueId: 'venue-1',
				...props
			}
		}
	});
}

describe('PriceCategorySection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('list rendering', () => {
		it('renders each category as a row pairing the color swatch with the name and hex text, ordered by display_order', async () => {
			mockResult(organizationadminvenuesListPriceCategories, { data: [gold, silver] });
			renderSection();

			const list = await screen.findByRole('list');
			const rows = within(list).getAllByRole('listitem');
			// Silver (display_order 0) sorts before Gold (display_order 1).
			expect(rows.map((row) => within(row).getByText(/Gold|Silver/).textContent)).toEqual([
				'Silver',
				'Gold'
			]);

			// The swatch is decorative (aria-hidden) and never the only carrier of
			// meaning: the name and the hex value are plain text next to it.
			const goldRow = rows[1];
			const swatch = goldRow.querySelector<HTMLElement>('span[aria-hidden="true"]');
			expect(swatch?.style.backgroundColor).toBe('rgb(249, 178, 51)');
			expect(within(goldRow).getByText('#f9b233')).toBeInTheDocument();
			expect(within(goldRow).getByText(/Order: 1/)).toBeInTheDocument();

			expect(organizationadminvenuesListPriceCategories).toHaveBeenCalledWith(
				expect.objectContaining({ path: { slug: 'test-org', venue_id: 'venue-1' } })
			);
		});

		it('shows the explanatory empty state when the venue has no categories', async () => {
			mockResult(organizationadminvenuesListPriceCategories, { data: [] });
			renderSection();

			expect(await screen.findByText('No price categories yet')).toBeInTheDocument();
			expect(screen.getByText(/Best Available seating assign seats/)).toBeInTheDocument();
		});
	});

	describe('create', () => {
		it('submits the exact create payload (trimmed name, #rrggbb color, display_order)', async () => {
			const user = userEvent.setup();
			mockResult(organizationadminvenuesListPriceCategories, { data: [] });
			mockResult(organizationadminvenuesCreatePriceCategory, {
				data: { ...gold, id: 'pc-new' },
				status: 201
			});
			renderSection();

			await user.click((await screen.findAllByRole('button', { name: 'Add Price Category' }))[0]);
			const dialog = await screen.findByRole('dialog');
			expect(within(dialog).getByText('Create Price Category')).toBeInTheDocument();

			await user.type(within(dialog).getByLabelText('Name'), '  Gold  ');
			const orderInput = within(dialog).getByLabelText('Display Order');
			await user.clear(orderInput);
			await user.type(orderInput, '2');
			await user.click(within(dialog).getByRole('button', { name: 'Create Category' }));

			await waitFor(() => {
				expect(organizationadminvenuesCreatePriceCategory).toHaveBeenCalledWith(
					expect.objectContaining({
						path: { slug: 'test-org', venue_id: 'venue-1' },
						body: { name: 'Gold', color: '#8c3cdd', display_order: 2 }
					})
				);
			});
			await waitFor(() => {
				expect(toast.success).toHaveBeenCalledWith('Price category created');
			});
		});

		it('falls back to display_order 0 when the order field is cleared', async () => {
			const user = userEvent.setup();
			mockResult(organizationadminvenuesListPriceCategories, { data: [] });
			mockResult(organizationadminvenuesCreatePriceCategory, {
				data: { ...gold, id: 'pc-new' },
				status: 201
			});
			renderSection();

			await user.click((await screen.findAllByRole('button', { name: 'Add Price Category' }))[0]);
			const dialog = await screen.findByRole('dialog');

			await user.type(within(dialog).getByLabelText('Name'), 'Balcony');
			// Clearing a number input binds null; the payload must coalesce to the
			// backend default rather than send display_order: null (400).
			await user.clear(within(dialog).getByLabelText('Display Order'));
			await user.click(within(dialog).getByRole('button', { name: 'Create Category' }));

			await waitFor(() => {
				expect(organizationadminvenuesCreatePriceCategory).toHaveBeenCalledWith(
					expect.objectContaining({
						body: { name: 'Balcony', color: '#8c3cdd', display_order: 0 }
					})
				);
			});
		});

		it('keeps the submit button disabled until a non-blank name is entered', async () => {
			const user = userEvent.setup();
			mockResult(organizationadminvenuesListPriceCategories, { data: [] });
			renderSection();

			await user.click((await screen.findAllByRole('button', { name: 'Add Price Category' }))[0]);
			const dialog = await screen.findByRole('dialog');
			const submit = within(dialog).getByRole('button', { name: 'Create Category' });

			expect(submit).toBeDisabled();
			await user.type(within(dialog).getByLabelText('Name'), '   ');
			expect(submit).toBeDisabled();
			expect(organizationadminvenuesCreatePriceCategory).not.toHaveBeenCalled();

			await user.type(within(dialog).getByLabelText('Name'), 'Balcony');
			expect(submit).toBeEnabled();
		});

		it('surfaces the backend 400 detail (duplicate name) inline in the modal', async () => {
			const user = userEvent.setup();
			mockResult(organizationadminvenuesListPriceCategories, { data: [] });
			mockResult(organizationadminvenuesCreatePriceCategory, {
				error: { detail: 'A price category with this name already exists for this venue.' },
				status: 400
			});
			renderSection();

			await user.click((await screen.findAllByRole('button', { name: 'Add Price Category' }))[0]);
			const dialog = await screen.findByRole('dialog');
			await user.type(within(dialog).getByLabelText('Name'), 'Gold');
			await user.click(within(dialog).getByRole('button', { name: 'Create Category' }));

			expect(await within(dialog).findByRole('alert')).toHaveTextContent(
				'A price category with this name already exists for this venue.'
			);
			// The modal stays open so the admin can fix the name.
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});
	});

	describe('edit', () => {
		it('prefills the modal from the row and sends the PUT to the category path', async () => {
			const user = userEvent.setup();
			mockResult(organizationadminvenuesListPriceCategories, { data: [gold] });
			mockResult(organizationadminvenuesUpdatePriceCategory, {
				data: { ...gold, name: 'Gold Circle' }
			});
			renderSection();

			await user.click(await screen.findByRole('button', { name: 'Edit price category Gold' }));
			const dialog = await screen.findByRole('dialog');
			expect(within(dialog).getByText('Edit Price Category')).toBeInTheDocument();

			// The form is prefilled from the category being edited.
			const nameInput = within(dialog).getByLabelText('Name');
			expect(nameInput).toHaveValue('Gold');
			expect(within(dialog).getByLabelText('Color')).toHaveValue('#f9b233');
			expect(within(dialog).getByLabelText('Display Order')).toHaveValue(1);

			await user.clear(nameInput);
			await user.type(nameInput, 'Gold Circle');
			await user.click(within(dialog).getByRole('button', { name: 'Save' }));

			await waitFor(() => {
				expect(organizationadminvenuesUpdatePriceCategory).toHaveBeenCalledWith(
					expect.objectContaining({
						path: { slug: 'test-org', venue_id: 'venue-1', category_id: 'pc-gold' },
						body: { name: 'Gold Circle', color: '#f9b233', display_order: 1 }
					})
				);
			});
			await waitFor(() => {
				expect(toast.success).toHaveBeenCalledWith('Price category updated');
			});
			expect(organizationadminvenuesCreatePriceCategory).not.toHaveBeenCalled();
		});
	});

	describe('delete', () => {
		it('deletes on confirm, shows the success toast, and refetches the list', async () => {
			const user = userEvent.setup();
			mockResult(organizationadminvenuesListPriceCategories, { data: [gold] });
			mockResult(organizationadminvenuesDeletePriceCategory, { data: undefined, status: 204 });
			vi.spyOn(window, 'confirm').mockReturnValue(true);
			renderSection();

			await user.click(await screen.findByRole('button', { name: 'Delete price category Gold' }));

			await waitFor(() => {
				expect(organizationadminvenuesDeletePriceCategory).toHaveBeenCalledWith(
					expect.objectContaining({
						path: { slug: 'test-org', venue_id: 'venue-1', category_id: 'pc-gold' }
					})
				);
			});
			await waitFor(() => {
				expect(toast.success).toHaveBeenCalledWith('Price category deleted');
			});
			// Success invalidates the list query, triggering a refetch.
			await waitFor(() => {
				expect(organizationadminvenuesListPriceCategories).toHaveBeenCalledTimes(2);
			});
		});

		it('surfaces the backend 400 detail when deletion is refused because a tier references the category', async () => {
			const user = userEvent.setup();
			const detail = 'Cannot delete: price category is referenced by ticket tier "VIP".';
			mockResult(organizationadminvenuesListPriceCategories, { data: [gold] });
			mockResult(organizationadminvenuesDeletePriceCategory, { error: { detail }, status: 400 });
			vi.spyOn(window, 'confirm').mockReturnValue(true);
			renderSection();

			await user.click(await screen.findByRole('button', { name: 'Delete price category Gold' }));

			expect(window.confirm).toHaveBeenCalledOnce();
			await waitFor(() => {
				expect(organizationadminvenuesDeletePriceCategory).toHaveBeenCalledWith(
					expect.objectContaining({
						path: { slug: 'test-org', venue_id: 'venue-1', category_id: 'pc-gold' }
					})
				);
			});
			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith(`Failed to delete price category: ${detail}`);
			});
		});

		it('does not call the delete op when the confirm dialog is dismissed', async () => {
			const user = userEvent.setup();
			mockResult(organizationadminvenuesListPriceCategories, { data: [gold] });
			vi.spyOn(window, 'confirm').mockReturnValue(false);
			renderSection();

			await user.click(await screen.findByRole('button', { name: 'Delete price category Gold' }));
			expect(organizationadminvenuesDeletePriceCategory).not.toHaveBeenCalled();
		});
	});
});
