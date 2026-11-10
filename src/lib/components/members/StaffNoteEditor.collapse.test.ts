import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));
vi.mock('$lib/api/client', () => ({ client: {} }));
const get = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminusernotesGetNote: get,
	organizationadminusernotesUpsertNote: put,
	organizationadminusernotesDeleteNote: vi.fn(),
	organizationadminusernotesGetRecordNote: vi.fn(),
	organizationadminusernotesUpsertRecordNote: vi.fn(),
	organizationadminusernotesDeleteRecordNote: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// A synchronous textarea stands in for the async Tiptap editor, which in jsdom
// would swap the textarea out from under a hidden (collapsed) panel.
vi.mock('$lib/components/forms/MarkdownEditor.svelte', async () => ({
	default: (await import('$lib/test-utils/MarkdownEditorStub.svelte')).default
}));

import StaffNoteEditor from './StaffNoteEditor.svelte';

const existing = {
	body: 'Allergic to nuts',
	updated_at: '2026-11-01T10:00:00Z',
	updated_by_id: 'u1',
	updated_by_name: 'Sam'
};

beforeEach(() => {
	get.mockReset();
	put.mockReset();
});

function renderIt() {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: StaffNoteEditor,
			componentProps: {
				slug: 'acme',
				target: { kind: 'user', userId: 'u2' },
				accessToken: 'tok',
				collapsible: true
			}
		}
	});
}

const toggleName = { name: 'Note details' };

describe('StaffNoteEditor collapsible', () => {
	it('is collapsed by default with a preview and no hint', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		const toggle = await screen.findByRole('button', toggleName);
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.getByTestId('staff-note-preview')).toHaveTextContent('Allergic to nuts');
		expect(screen.queryByText(/never shown to the person/i)).not.toBeInTheDocument();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});

	it('shows readable text, not Markdown, in the preview', async () => {
		get.mockResolvedValue({
			data: { ...existing, body: '**Allergic** to nuts\n- carries epipen' },
			response: { status: 200 }
		});
		renderIt();
		expect(await screen.findByTestId('staff-note-preview')).toHaveTextContent(
			'Allergic to nuts carries epipen'
		);
	});

	it('says "No note yet." for an empty note; the toggle opens the editor', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		renderIt();
		const toggle = await screen.findByRole('button', toggleName);
		expect(screen.getByTestId('staff-note-preview')).toHaveTextContent('No note yet.');
		await userEvent.click(toggle);
		expect(await screen.findByRole('textbox')).toBeVisible();
	});

	it('keeps a stable accessible name while aria-expanded toggles; the preview is removed when open', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		const toggle = await screen.findByRole('button', toggleName);
		await userEvent.click(toggle);
		expect(screen.getByRole('button', toggleName)).toHaveAttribute('aria-expanded', 'true');
		const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
		expect(panel).toContainElement(screen.getByRole('textbox'));
		expect(screen.getByRole('textbox')).toBeVisible();
		expect(screen.getByText(/never shown to the person/i)).toBeInTheDocument();
		expect(screen.queryByTestId('staff-note-preview')).not.toBeInTheDocument();
		await userEvent.click(toggle);
		expect(screen.getByRole('button', toggleName)).toHaveAttribute('aria-expanded', 'false');
		expect(screen.getByTestId('staff-note-preview')).toBeInTheDocument();
	});

	it('blocks collapsing while there are unsaved edits, then allows it after saving', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		put.mockResolvedValue({
			data: { ...existing, body: 'Draft edit' },
			response: { status: 200 }
		});
		renderIt();
		await userEvent.click(await screen.findByRole('button', toggleName));
		expect(screen.queryByTestId('staff-note-dirty-hint')).not.toBeInTheDocument();
		await userEvent.type(screen.getByRole('textbox'), ' more');
		const toggle = screen.getByRole('button', toggleName);
		expect(toggle).toBeDisabled();
		const hint = screen.getByTestId('staff-note-dirty-hint');
		expect(hint).toHaveTextContent('Save your changes before hiding the note.');
		expect(toggle.getAttribute('aria-describedby')).toBe(hint.id);
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
		await waitFor(() => expect(screen.getByRole('button', toggleName)).toBeEnabled());
		expect(screen.queryByTestId('staff-note-dirty-hint')).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', toggleName));
		expect(screen.getByTestId('staff-note-preview')).toBeInTheDocument();
	});

	it('disables the editor while saving', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		put.mockReturnValue(new Promise(() => undefined));
		renderIt();
		await userEvent.click(await screen.findByRole('button', toggleName));
		await userEvent.type(screen.getByRole('textbox'), ' more');
		await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
		await waitFor(() => expect(screen.getByRole('textbox')).toBeDisabled());
	});

	it('gives two editors distinct ids', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		renderIt();
		const toggles = await screen.findAllByRole('button', toggleName);
		expect(toggles).toHaveLength(2);
		expect(toggles[0].getAttribute('aria-controls')).not.toBe(
			toggles[1].getAttribute('aria-controls')
		);
	});
});
