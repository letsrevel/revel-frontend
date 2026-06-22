// $env/dynamic/public is a SvelteKit virtual module not available in jsdom.
// Mock it so the $lib/utils barrel → $lib/config/api import chain doesn't fail.
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));

import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import LinkDialog from './LinkDialog.svelte';

describe('LinkDialog', () => {
	it('rejects a disallowed scheme and does not apply', async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();
		render(LinkDialog, { props: { open: true, onApply, onClose: vi.fn() } });
		await user.type(screen.getByLabelText(/url/i), 'javascript:alert(1)');
		await user.click(screen.getByRole('button', { name: /apply|insert/i }));
		expect(onApply).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('applies an https link', async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();
		render(LinkDialog, { props: { open: true, onApply, onClose: vi.fn() } });
		await user.type(screen.getByLabelText(/url/i), 'https://example.com');
		await user.type(screen.getByLabelText(/text/i), 'Example');
		await user.click(screen.getByRole('button', { name: /apply|insert/i }));
		expect(onApply).toHaveBeenCalledWith({ url: 'https://example.com', text: 'Example' });
	});
});
