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
const rget = vi.hoisted(() => vi.fn());
const rput = vi.hoisted(() => vi.fn());
const rdel = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminusernotesGetNote: get,
	organizationadminusernotesUpsertNote: put,
	organizationadminusernotesDeleteNote: del,
	organizationadminusernotesGetRecordNote: rget,
	organizationadminusernotesUpsertRecordNote: rput,
	organizationadminusernotesDeleteRecordNote: rdel
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import StaffNoteEditor from './StaffNoteEditor.svelte';
import type { NoteTarget } from './user-note';

function renderIt(
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
	target: NoteTarget = { kind: 'user', userId: 'u2' }
) {
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: StaffNoteEditor,
			componentProps: { slug: 'acme', target, accessToken: 'tok' }
		}
	});
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
	rget.mockReset();
	rput.mockReset().mockResolvedValue({ data: existing, response: { status: 200 } });
	rdel.mockReset().mockResolvedValue({ response: { status: 204 } });
});

describe('StaffNoteEditor', () => {
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

	it('saves a non-empty note and stays open on the saved text', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		renderIt();
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
		expect(await screen.findByText(/Last edited by Sam on /)).toBeInTheDocument();
	});

	it('asks for confirmation (the shared confirm dialog) before an empty save deletes the note', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		const textbox = await screen.findByRole('textbox');
		await waitFor(() => expect(textbox).toHaveValue('Allergic to nuts'));
		setNoteText(textbox, '');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));

		expect(put).not.toHaveBeenCalled();
		expect(await screen.findByText('Delete this note?')).toBeInTheDocument();
		expect(del).not.toHaveBeenCalled();

		const confirm = screen.getByRole('dialog');
		await userEvent.click(within(confirm).getByRole('button', { name: 'Delete note' }));
		await waitFor(() => expect(del).toHaveBeenCalled());
		expect(await screen.findByText('No note yet.')).toBeInTheDocument();
	});

	it('does not delete when the confirmation is cancelled', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		await userEvent.click(await screen.findByRole('button', { name: 'Delete note' }));
		await userEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i })
		);
		expect(del).not.toHaveBeenCalled();
	});

	it('renders a server error from a failed save', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		put.mockResolvedValue({ error: { detail: 'Note is too long' }, response: { status: 400 } });
		renderIt();
		setNoteText(await screen.findByRole('textbox'), 'x');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Note is too long');
	});

	it('shows the localized fallback, never raw Error.message, when a save throws', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		put.mockRejectedValue(new TypeError('Failed to fetch'));
		renderIt();
		setNoteText(await screen.findByRole('textbox'), 'x');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Could not save the note.');
		expect(alert).not.toHaveTextContent('Failed to fetch');
	});

	it('uses the save fallback for an empty response', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		put.mockResolvedValue({ response: { status: 200 } });
		renderIt();
		setNoteText(await screen.findByRole('textbox'), 'x');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the note.');
	});

	it('uses a delete-specific fallback when deleting fails', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		del.mockRejectedValue(new Error('boom'));
		renderIt();
		await userEvent.click(await screen.findByRole('button', { name: 'Delete note' }));
		await userEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete note' })
		);
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Could not delete the note.');
		expect(alert).not.toHaveTextContent('boom');
	});

	it('uses distinct confirmation copy for the explicit delete button', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		await userEvent.click(await screen.findByRole('button', { name: 'Delete note' }));
		expect(await screen.findByText("Delete this note? This can't be undone.")).toBeInTheDocument();
		expect(screen.queryByText(/Saving an empty note deletes it/)).not.toBeInTheDocument();
	});

	it('writes the PUT response into the cache without refetching, and refreshes the lists', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const invalidate = vi.spyOn(client, 'invalidateQueries');
		renderIt(client);
		setNoteText(await screen.findByRole('textbox'), 'Hello');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
		await waitFor(() =>
			expect(client.getQueryData(['organization', 'acme', 'user-note', 'u2'])).toEqual(existing)
		);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ['organization', 'acme', 'members'] });
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: ['organization', 'acme', 'member-register']
		});
		expect(get).toHaveBeenCalledTimes(1);
	});

	describe('record target', () => {
		const record: NoteTarget = { kind: 'record', recordId: 'r1' };

		it('reads, saves and deletes through the record route (an unlinked or linked entry)', async () => {
			rget.mockResolvedValue({ data: existing, response: { status: 200 } });
			renderIt(undefined, record);
			expect(await screen.findByText(/Last edited by Sam on /)).toBeInTheDocument();
			expect(rget).toHaveBeenCalledWith(
				expect.objectContaining({ path: { slug: 'acme', record_id: 'r1' } })
			);
			expect(get).not.toHaveBeenCalled();

			const textbox = screen.getByRole('textbox');
			await waitFor(() => expect(textbox).toHaveValue('Allergic to nuts'));
			setNoteText(textbox, 'Updated');
			await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
			await waitFor(() =>
				expect(rput).toHaveBeenCalledWith(
					expect.objectContaining({
						path: { slug: 'acme', record_id: 'r1' },
						body: { body: 'Updated' }
					})
				)
			);
			expect(put).not.toHaveBeenCalled();

			await userEvent.click(screen.getByRole('button', { name: 'Delete note' }));
			await userEvent.click(
				within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete note' })
			);
			await waitFor(() =>
				expect(rdel).toHaveBeenCalledWith(
					expect.objectContaining({ path: { slug: 'acme', record_id: 'r1' } })
				)
			);
			expect(del).not.toHaveBeenCalled();
		});

		it('treats a 404 on the record route as an empty note', async () => {
			rget.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
			renderIt(undefined, record);
			expect(await screen.findByText('No note yet.')).toBeInTheDocument();
		});
	});
});
