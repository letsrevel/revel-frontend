import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import DietaryPreferencesManager from './DietaryPreferencesManager.svelte';
import { toast } from 'svelte-sonner';
import {
	dietaryListMyDietaryPreferences,
	dietaryListDietaryPreferences,
	dietaryDeleteDietaryPreference
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	dietaryListMyDietaryPreferences: vi.fn(),
	dietaryListDietaryPreferences: vi.fn(),
	dietaryAddDietaryPreference: vi.fn(),
	dietaryDeleteDietaryPreference: vi.fn(),
	dietaryUpdateDietaryPreference: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type MyListResult = Awaited<ReturnType<typeof dietaryListMyDietaryPreferences>>;
type ListResult = Awaited<ReturnType<typeof dietaryListDietaryPreferences>>;
type DeleteResult = Awaited<ReturnType<typeof dietaryDeleteDietaryPreference>>;

function ok<T>(data: T) {
	return { data, error: undefined, response: { ok: true, status: 200 } as Response };
}

const userPreference = {
	id: 'up1',
	preference: { id: 'p1', name: 'Vegan' },
	comment: '',
	is_public: true
};

function renderManager() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: DietaryPreferencesManager,
			componentProps: { authToken: 'tok' }
		}
	});
}

describe('DietaryPreferencesManager delete error handling', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('confirm', () => true);
		vi.mocked(dietaryListMyDietaryPreferences).mockResolvedValue(
			ok([userPreference]) as unknown as MyListResult
		);
		vi.mocked(dietaryListDietaryPreferences).mockResolvedValue(ok([]) as unknown as ListResult);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('toasts an error and no success when removing a preference fails', async () => {
		vi.mocked(dietaryDeleteDietaryPreference).mockResolvedValue({
			data: undefined,
			error: { detail: 'Nope' },
			response: { ok: false, status: 400 } as Response
		} as unknown as DeleteResult);
		const user = userEvent.setup();
		renderManager();

		const remove = await screen.findByRole('button', { name: 'Remove Vegan' });
		await user.click(remove);

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(toast.success).not.toHaveBeenCalled();
	});
});
