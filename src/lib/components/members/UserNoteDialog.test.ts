import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** jsdom has no real Tiptap editor: drive the fallback textarea like the editor's own tests. */
function setNoteText(textbox: HTMLElement, value: string): void {
	(textbox as HTMLTextAreaElement).value = value;
	textbox.dispatchEvent(new Event('input', { bubbles: true }));
}
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));
vi.mock('$lib/api/client', () => ({ client: {} }));
const get = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminusernotesGetNote: get,
	organizationadminusernotesUpsertNote: put,
	organizationadminusernotesDeleteNote: del
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import UserNoteDialog from './UserNoteDialog.svelte';

function renderIt(onClose = vi.fn()) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: UserNoteDialog,
			componentProps: {
				open: true,
				slug: 'acme',
				userId: 'u2',
				displayName: 'Ada Lovelace',
				accessToken: 'tok',
				onClose
			}
		}
	});
	return onClose;
}

const existing = {
	body: 'Allergic to nuts',
	updated_at: '2026-11-01T10:00:00Z',
	updated_by_id: 'u1',
	updated_by_name: 'Sam'
};

beforeEach(() => {
	get.mockReset();
	put.mockReset().mockResolvedValue({ data: existing, response: { status: 200 } });
	del.mockReset().mockResolvedValue({ response: { status: 204 } });
});

describe('UserNoteDialog', () => {
	it('treats a 404 as an empty note and shows the privacy hint', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		renderIt();
		expect(await screen.findByText('No note yet.')).toBeInTheDocument();
		expect(screen.getByText(/never shown to the person/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Delete note' })).not.toBeInTheDocument();
	});

	it('shows the last-edited line with the editor name', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		expect(await screen.findByText(/Last edited by Sam on /)).toBeInTheDocument();
	});

	it('names a former staff member when the editor account is gone', async () => {
		get.mockResolvedValue({
			data: { ...existing, updated_by_id: null, updated_by_name: null },
			response: { status: 200 }
		});
		renderIt();
		expect(await screen.findByText(/Last edited by a former staff member on /)).toBeInTheDocument();
	});

	it('saves a non-empty note', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		const onClose = renderIt();
		const textbox = await screen.findByRole('textbox');
		setNoteText(textbox, 'Hello');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
		await waitFor(() =>
			expect(put).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { slug: 'acme', user_id: 'u2' },
					body: { body: 'Hello' }
				})
			)
		);
		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});

	it('asks for confirmation before an empty save deletes the note', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		const onClose = renderIt();
		const textbox = await screen.findByRole('textbox');
		await waitFor(() => expect(textbox).toHaveValue('Allergic to nuts'));
		setNoteText(textbox, '');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));

		expect(put).not.toHaveBeenCalled();
		expect(await screen.findByText('Delete this note?')).toBeInTheDocument();
		expect(del).not.toHaveBeenCalled();

		const dialogs = screen.getAllByRole('dialog');
		const confirm = dialogs[dialogs.length - 1];
		await userEvent.click(within(confirm).getByRole('button', { name: 'Delete note' }));
		await waitFor(() => expect(del).toHaveBeenCalled());
		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});

	it('renders a server error from a failed save', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		put.mockResolvedValue({ error: { detail: 'Note is too long' }, response: { status: 400 } });
		renderIt();
		setNoteText(await screen.findByRole('textbox'), 'x');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Note is too long');
	});
});
