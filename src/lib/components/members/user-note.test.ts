import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminusernotesGetNote: get,
	organizationadminusernotesUpsertNote: put,
	organizationadminusernotesDeleteNote: del
}));

import {
	NOTE_MAX_LENGTH,
	deleteUserNote,
	fetchUserNote,
	noteCounter,
	saveUserNote,
	userNoteKey
} from './user-note';

const note = {
	body: 'Allergic to nuts',
	updated_at: '2026-11-01T10:00:00Z',
	updated_by_id: 'u1',
	updated_by_name: 'Sam'
};

beforeEach(() => {
	get.mockReset();
	put.mockReset();
	del.mockReset();
});

describe('fetchUserNote', () => {
	it('returns the note on 200', async () => {
		get.mockResolvedValue({ data: note, response: { status: 200 } });
		await expect(fetchUserNote('acme', 'u2', 'tok')).resolves.toEqual(note);
		expect(get).toHaveBeenCalledWith(
			expect.objectContaining({ path: { slug: 'acme', user_id: 'u2' } })
		);
	});

	it('maps a 404 to null (no note yet), not an error', async () => {
		get.mockResolvedValue({ error: { detail: 'Not found' }, response: { status: 404 } });
		await expect(fetchUserNote('acme', 'u2', 'tok')).resolves.toBeNull();
	});

	it('throws the response error for any other failure', async () => {
		const error = { detail: 'Forbidden' };
		get.mockResolvedValue({ error, response: { status: 403 } });
		await expect(fetchUserNote('acme', 'u2', 'tok')).rejects.toBe(error);
	});
});

describe('saveUserNote / deleteUserNote', () => {
	it('throws res.error on a failed save', async () => {
		const error = { detail: 'Too long' };
		put.mockResolvedValue({ error, response: { status: 400 } });
		await expect(saveUserNote('acme', 'u2', 'x', 'tok')).rejects.toBe(error);
	});

	it('sends the body on save', async () => {
		put.mockResolvedValue({ data: note, response: { status: 200 } });
		await saveUserNote('acme', 'u2', 'hello', 'tok');
		expect(put).toHaveBeenCalledWith(expect.objectContaining({ body: { body: 'hello' } }));
	});

	it('treats deleting an already-gone note as success', async () => {
		del.mockResolvedValue({ error: { detail: 'Not found' }, response: { status: 404 } });
		await expect(deleteUserNote('acme', 'u2', 'tok')).resolves.toBeUndefined();
	});

	it('throws res.error on a failed delete', async () => {
		const error = { detail: 'Forbidden' };
		del.mockResolvedValue({ error, response: { status: 403 } });
		await expect(deleteUserNote('acme', 'u2', 'tok')).rejects.toBe(error);
	});
});

describe('noteCounter', () => {
	it('is silent well below the cap', () => {
		expect(noteCounter('hello')).toEqual({
			count: 5,
			remaining: NOTE_MAX_LENGTH - 5,
			over: 0,
			state: 'ok'
		});
	});

	it('warns from 90% of the cap', () => {
		expect(noteCounter('x'.repeat(4500)).state).toBe('near');
		expect(noteCounter('x'.repeat(4499)).state).toBe('ok');
	});

	it('is exactly allowed at the cap and over one character beyond it', () => {
		expect(noteCounter('x'.repeat(NOTE_MAX_LENGTH)).state).toBe('near');
		const over = noteCounter('x'.repeat(NOTE_MAX_LENGTH + 3));
		expect(over.state).toBe('over');
		expect(over.over).toBe(3);
		expect(over.remaining).toBe(0);
	});
});

describe('userNoteKey', () => {
	it('is scoped per (slug, user)', () => {
		expect(userNoteKey('acme', 'u1')).not.toEqual(userNoteKey('acme', 'u2'));
		expect(userNoteKey('acme', 'u1')).not.toEqual(userNoteKey('other', 'u1'));
	});
});
