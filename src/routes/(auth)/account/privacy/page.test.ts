import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import Page from './+page.svelte';
import {
	questionnairefileListFiles,
	questionnairefileDeleteFile
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	questionnairefileListFiles: vi.fn(),
	questionnairefileDeleteFile: vi.fn()
}));
vi.mock('$app/forms', () => ({
	enhance: () => ({
		destroy: () => {
			// no-op: the account-deletion form action is not under test
		}
	})
}));

type ListResult = Awaited<ReturnType<typeof questionnairefileListFiles>>;
type DeleteResult = Awaited<ReturnType<typeof questionnairefileDeleteFile>>;

const file = {
	id: 'file-1',
	original_filename: 'answer.pdf',
	mime_type: 'application/pdf',
	file_size: 1024,
	file_url: null,
	created_at: '2026-09-01T10:00:00Z'
};

function renderPage() {
	// Mirror the app-level QueryClient contract from +layout.svelte: mutations
	// without a local onError fall through to a global handler that surfaces
	// the failure. The page's delete mutation must throw for that to happen.
	const onMutationError = vi.fn();
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false, onError: onMutationError }
		}
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: Page,
			componentProps: { form: null }
		}
	});
	return { onMutationError };
}

describe('privacy page file delete error handling', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(questionnairefileListFiles).mockResolvedValue({
			data: { results: [file], count: 1 },
			error: undefined,
			response: { ok: true, status: 200 } as Response
		} as unknown as ListResult);
	});

	it('propagates a failed delete to the global mutation error handler and keeps the file listed', async () => {
		vi.mocked(questionnairefileDeleteFile).mockResolvedValue({
			data: undefined,
			error: { detail: 'Nope' },
			response: { ok: false, status: 400 } as Response
		} as unknown as DeleteResult);
		const user = userEvent.setup();
		const { onMutationError } = renderPage();

		await user.click(await screen.findByRole('button', { name: 'Delete file' }));
		await user.click(await screen.findByRole('button', { name: 'Delete File' }));

		await waitFor(() => expect(onMutationError).toHaveBeenCalled());
		expect(screen.getByText('answer.pdf')).toBeInTheDocument();
	});
});
