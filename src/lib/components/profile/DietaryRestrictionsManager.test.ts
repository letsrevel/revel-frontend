import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import DietaryRestrictionsManager from './DietaryRestrictionsManager.svelte';
import { toast } from 'svelte-sonner';
import {
	dietaryListDietaryRestrictions,
	dietaryListFoodItems,
	dietaryDeleteDietaryRestriction,
	dietaryCreateFoodItem
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	dietaryListDietaryRestrictions: vi.fn(),
	dietaryListFoodItems: vi.fn(),
	dietaryCreateFoodItem: vi.fn(),
	dietaryCreateDietaryRestriction: vi.fn(),
	dietaryDeleteDietaryRestriction: vi.fn(),
	dietaryUpdateDietaryRestriction: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type RestrictionsResult = Awaited<ReturnType<typeof dietaryListDietaryRestrictions>>;
type FoodItemsResult = Awaited<ReturnType<typeof dietaryListFoodItems>>;
type DeleteResult = Awaited<ReturnType<typeof dietaryDeleteDietaryRestriction>>;
type CreateFoodItemResult = Awaited<ReturnType<typeof dietaryCreateFoodItem>>;

function ok<T>(data: T) {
	return { data, error: undefined, response: { ok: true, status: 200 } as Response };
}

const restriction = {
	id: 'r1',
	food_item: { id: 'f1', name: 'Peanuts' },
	restriction_type: 'allergy',
	notes: '',
	is_public: true
};

function renderManager() {
	// Mirrors the app QueryClient: a default mutations.onError (the global
	// "Action failed" toast in +layout.svelte) that skips errors marked
	// `silent: true`.
	const globalOnError = vi.fn();
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false, onError: globalOnError }
		}
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: DietaryRestrictionsManager,
			componentProps: { authToken: 'tok' }
		}
	});
	return { globalOnError };
}

describe('DietaryRestrictionsManager delete error handling', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('confirm', () => true);
		vi.mocked(dietaryListDietaryRestrictions).mockResolvedValue(
			ok([restriction]) as unknown as RestrictionsResult
		);
		vi.mocked(dietaryListFoodItems).mockResolvedValue(ok([]) as unknown as FoodItemsResult);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('marks a failed food-item creation silent so the global toast does not duplicate the catch toast', async () => {
		vi.mocked(dietaryCreateFoodItem).mockResolvedValue({
			data: undefined,
			error: { detail: 'Nope' },
			response: { ok: false, status: 400 } as Response
		} as unknown as CreateFoodItemResult);
		const user = userEvent.setup();
		const { globalOnError } = renderManager();

		await user.click((await screen.findAllByRole('button', { name: 'Add Restriction' }))[0]);
		const dialog = await screen.findByRole('dialog');
		await user.type(within(dialog).getByLabelText('Food or ingredient'), 'Durian');
		await user.click(within(dialog).getByRole('button', { name: 'Add Restriction' }));

		// handleAddRestriction's catch already toasts the failure...
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		// ...so the thrown error must carry `silent: true` for the global handler.
		await waitFor(() => expect(globalOnError).toHaveBeenCalled());
		expect(globalOnError.mock.calls[0][0]).toMatchObject({ silent: true });
	});

	it('toasts an error and no success when removing a restriction fails', async () => {
		vi.mocked(dietaryDeleteDietaryRestriction).mockResolvedValue({
			data: undefined,
			error: { detail: 'Nope' },
			response: { ok: false, status: 400 } as Response
		} as unknown as DeleteResult);
		const user = userEvent.setup();
		renderManager();

		const remove = await screen.findByRole('button', { name: 'Remove Peanuts' });
		await user.click(remove);

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(toast.success).not.toHaveBeenCalled();
	});
});
