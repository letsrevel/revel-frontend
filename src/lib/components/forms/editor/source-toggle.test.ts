// $env/dynamic/public is a SvelteKit virtual module not available in jsdom.
// Mock it so the $lib/utils barrel → $lib/config/api import chain doesn't fail.
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));

import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import MarkdownEditor from '../MarkdownEditor.svelte';

describe('source toggle', () => {
	it('shows current markdown in source mode and round-trips back', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(MarkdownEditor, { props: { value: '**hi**', id: 'd', label: 'L', onValueChange } });
		await waitFor(() => screen.getByRole('button', { name: /source/i }));
		await user.click(screen.getByRole('button', { name: /source/i }));
		const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(ta.value).toContain('**hi**');
		await user.clear(ta);
		await user.type(ta, '## new');
		// Assert that editing in source mode calls onValueChange with the new markdown
		await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(expect.stringContaining('## new')));
		await user.click(screen.getByRole('button', { name: /exit source|done/i }));
		// back in WYSIWYG; value updated
		await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
	});
});
