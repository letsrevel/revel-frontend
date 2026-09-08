import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import DietaryRestrictionsManager from './DietaryRestrictionsManager.svelte';
import { toast } from 'svelte-sonner';
import {
	dietaryListDietaryRestrictions,
	dietaryListFoodItems,
	dietaryDeleteDietaryRestriction
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
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: DietaryRestrictionsManager,
			componentProps: { authToken: 'tok' }
		}
	});
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
