import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));
vi.mock('$lib/api/client', () => ({ client: {} }));
const get = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminusernotesGetNote: get,
	organizationadminusernotesUpsertNote: vi.fn(),
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
});

function renderIt() {
	render(QueryClientTestWrapper, {
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

describe('StaffNoteEditor collapsible', () => {
	it('is collapsed by default with a preview and no hint', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		const toggle = await screen.findByRole('button', { name: 'Show and edit note' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.getByTestId('staff-note-preview')).toHaveTextContent('Allergic to nuts');
		expect(screen.getByTestId('staff-note-preview')).toBeVisible();
		expect(screen.queryByText(/never shown to the person/i)).not.toBeInTheDocument();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});

	it('says "No note yet." for an empty note and offers to add one', async () => {
		get.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		renderIt();
		const toggle = await screen.findByRole('button', { name: 'Add a note' });
		expect(screen.getByTestId('staff-note-preview')).toHaveTextContent('No note yet.');
		await userEvent.click(toggle);
		expect(await screen.findByRole('textbox')).toBeVisible();
	});

	it('expands to the editor and hint, and aria-expanded toggles', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		await userEvent.click(await screen.findByRole('button', { name: 'Show and edit note' }));
		const toggle = screen.getByRole('button', { name: 'Hide note' });
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(toggle).toHaveAttribute('aria-controls', 'staff-note-panel');
		expect(screen.getByRole('textbox')).toBeVisible();
		expect(screen.getByText(/never shown to the person/i)).toBeInTheDocument();
		expect(screen.getByTestId('staff-note-preview')).not.toBeVisible();
		await userEvent.click(toggle);
		expect(screen.getByRole('button', { name: 'Show and edit note' })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
	});

	it('keeps unsaved edits across collapse and expand', async () => {
		get.mockResolvedValue({ data: existing, response: { status: 200 } });
		renderIt();
		await userEvent.click(await screen.findByRole('button', { name: 'Show and edit note' }));
		const box = screen.getByRole('textbox');
		await userEvent.clear(box);
		await userEvent.type(box, 'Draft edit');
		await userEvent.click(screen.getByRole('button', { name: 'Hide note' }));
		expect(screen.getByTestId('staff-note-preview')).toHaveTextContent('Draft edit');
		await userEvent.click(screen.getByRole('button', { name: 'Show and edit note' }));
		expect(screen.getByRole('textbox')).toHaveValue('Draft edit');
	});
});
