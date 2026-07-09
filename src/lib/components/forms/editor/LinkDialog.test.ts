// $env/dynamic/public is a SvelteKit virtual module not available in jsdom.
// Mock it so the $lib/utils barrel → $lib/config/api import chain doesn't fail.
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));

import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import LinkDialog from './LinkDialog.svelte';

// Note on fireEvent.input vs userEvent.type: bits-ui 2's dialog focus scope
// re-grabs focus to Dialog.Content after each re-render in jsdom (no real
// focusin sequencing), so userEvent.type only lands the first character.
// fireEvent.input drives bind:value directly; browsers are unaffected.

describe('LinkDialog', () => {
	it('rejects a disallowed scheme and does not apply', async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();
		render(LinkDialog, { props: { open: true, onApply, onClose: vi.fn() } });
		await fireEvent.input(screen.getByLabelText(/url/i), {
			target: { value: 'javascript:alert(1)' }
		});
		await user.click(screen.getByRole('button', { name: /apply|insert/i }));
		expect(onApply).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('applies an https link', async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();
		render(LinkDialog, { props: { open: true, onApply, onClose: vi.fn() } });
		await fireEvent.input(screen.getByLabelText(/url/i), {
			target: { value: 'https://example.com' }
		});
		await fireEvent.input(screen.getByLabelText(/text/i), { target: { value: 'Example' } });
		await user.click(screen.getByRole('button', { name: /apply|insert/i }));
		expect(onApply).toHaveBeenCalledWith({ url: 'https://example.com', text: 'Example' });
	});

	it('calls onClose but not onApply when the dialog is cancelled via Escape', async () => {
		// In jsdom, Bits UI Dialog fires onOpenChange (and therefore onClose) on Escape.
		// This covers the "non-apply close" path: onClose fires, onApply does not.
		const user = userEvent.setup();
		const onApply = vi.fn();
		const onClose = vi.fn();
		render(LinkDialog, { props: { open: true, onApply, onClose } });

		// Press Escape to dismiss the dialog without applying.
		await user.keyboard('{Escape}');

		expect(onClose).toHaveBeenCalled();
		expect(onApply).not.toHaveBeenCalled();
	});
});
