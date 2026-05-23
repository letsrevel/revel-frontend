import { render, screen, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import PollUrlStrip from './PollUrlStrip.svelte';

// Mock svelte-sonner
vi.mock('svelte-sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

describe('PollUrlStrip', () => {
	let writeTextSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		writeTextSpy = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: { writeText: writeTextSpy }
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('renders the URL', () => {
		render(PollUrlStrip, { props: { url: 'https://x/y' } });
		const input = screen.getByRole('textbox', { name: /share url/i });
		expect((input as HTMLInputElement).value).toBe('https://x/y');
	});

	it('writes to clipboard when Copy is clicked', async () => {
		render(PollUrlStrip, { props: { url: 'https://x/y' } });
		const button = screen.getByRole('button', { name: /copy/i });

		// Directly call click to trigger the onclick handler
		button.click();

		// Give time for the async call to complete
		await waitFor(() => {
			expect(writeTextSpy).toHaveBeenCalledWith('https://x/y');
		});
	});
});
