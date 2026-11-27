import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const addTags = vi.hoisted(() => vi.fn());
const removeTags = vi.hoisted(() => vi.fn());
const listTags = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersAddTags: addTags,
	organizationadminmembersRemoveTags: removeTags,
	tagListTags: listTags
}));

import OrgTagManager from './OrgTagManager.svelte';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
}

function answer(names: string[]): { data: { results: { name: string }[] } } {
	return { data: { results: names.map((name) => ({ name })) } };
}

function renderIt(initialTags: string[] = []): { save: () => Promise<void> } {
	let save: (() => Promise<void>) | undefined;
	render(OrgTagManager, {
		props: {
			slug: 'org',
			accessToken: 'tok',
			initialTags,
			onRegisterSave: (fn: () => Promise<void>) => {
				save = fn;
			}
		}
	});
	return {
		save: async () => {
			if (!save) throw new Error('save callback was not registered');
			await save();
		}
	};
}

const input = (): HTMLInputElement => screen.getByRole('textbox') as HTMLInputElement;

describe('OrgTagManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		addTags.mockResolvedValue({});
		removeTags.mockResolvedValue({});
		listTags.mockResolvedValue(answer([]));
	});

	it('does not add a tag twice when only the letter case differs', async () => {
		const user = userEvent.setup();
		renderIt();
		await user.type(input(), 'Fun{Enter}');
		await user.type(input(), 'fun{Enter}');
		expect(screen.getAllByRole('button', { name: /^Remove .* tag$/ })).toHaveLength(1);
		expect(screen.getByRole('button', { name: 'Remove Fun tag' })).toBeInTheDocument();
		expect(input().value).toBe('');
	});

	it('adds nothing and keeps the input for a name that cleans to empty', async () => {
		const user = userEvent.setup();
		renderIt();
		await user.type(input(), '#{Enter}');
		expect(screen.queryAllByRole('button', { name: /^Remove .* tag$/ })).toHaveLength(0);
		expect(input().value).toBe('#');
	});

	it('uses the casing of a matching suggestion for typed text', async () => {
		const user = userEvent.setup();
		listTags.mockResolvedValue(answer(['Fun']));
		renderIt();
		await user.type(input(), 'fun');
		await screen.findByRole('button', { name: 'Fun' });
		await user.keyboard('{Enter}');
		expect(screen.getByRole('button', { name: 'Remove Fun tag' })).toBeInTheDocument();
	});

	it('sends no request when a save only changes the letter case of a tag', async () => {
		const user = userEvent.setup();
		const { save } = renderIt(['Fun']);
		await user.click(screen.getByRole('button', { name: 'Remove Fun tag' }));
		await user.type(input(), 'fun{Enter}');
		await save();
		expect(removeTags).not.toHaveBeenCalled();
		expect(addTags).not.toHaveBeenCalled();
	});

	it('shows the stored casing after a save that only changes the letter case', async () => {
		const user = userEvent.setup();
		const { save } = renderIt(['Fun']);
		await user.click(screen.getByRole('button', { name: 'Remove Fun tag' }));
		await user.type(input(), 'fun{Enter}');
		expect(screen.getByRole('button', { name: 'Remove fun tag' })).toBeInTheDocument();
		await save();
		expect(await screen.findByRole('button', { name: 'Remove Fun tag' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Remove fun tag' })).not.toBeInTheDocument();
	});

	it('sends the real adds and removes on save', async () => {
		const user = userEvent.setup();
		const { save } = renderIt(['old']);
		await user.click(screen.getByRole('button', { name: 'Remove old tag' }));
		await user.type(input(), 'new{Enter}');
		await save();
		expect(addTags).toHaveBeenCalledWith(expect.objectContaining({ body: { tags: ['new'] } }));
		expect(removeTags).toHaveBeenCalledWith(expect.objectContaining({ body: { tags: ['old'] } }));
	});

	describe('search answers', () => {
		it('drops an older answer that arrives after a newer one, and keeps the spinner for the newer search', async () => {
			const user = userEvent.setup();
			const first = deferred<ReturnType<typeof answer>>();
			const second = deferred<ReturnType<typeof answer>>();
			listTags.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
			renderIt();

			await user.type(input(), 'a');
			await waitFor(() => expect(listTags).toHaveBeenCalledTimes(1));
			await user.type(input(), 'b');
			await waitFor(() => expect(listTags).toHaveBeenCalledTimes(2));
			expect(screen.getByTestId('tag-search-spinner')).toBeInTheDocument();

			// The older search ends first: its answer is stale and the spinner stays.
			first.resolve(answer(['stale-tag']));
			await Promise.resolve();
			await Promise.resolve();
			expect(screen.queryByRole('button', { name: 'stale-tag' })).not.toBeInTheDocument();
			expect(screen.getByTestId('tag-search-spinner')).toBeInTheDocument();

			second.resolve(answer(['ab-tag']));
			await screen.findByRole('button', { name: 'ab-tag' });
			expect(screen.queryByRole('button', { name: 'stale-tag' })).not.toBeInTheDocument();
			expect(screen.queryByTestId('tag-search-spinner')).not.toBeInTheDocument();
		});

		it('does not reopen the list when an answer arrives after the tag was added', async () => {
			const user = userEvent.setup();
			const pending = deferred<ReturnType<typeof answer>>();
			listTags.mockReturnValueOnce(pending.promise);
			renderIt();

			await user.type(input(), 'x');
			await waitFor(() => expect(listTags).toHaveBeenCalledTimes(1));
			await user.keyboard('{Enter}');
			expect(screen.queryByTestId('tag-search-spinner')).not.toBeInTheDocument();

			pending.resolve(answer(['xylophone']));
			await Promise.resolve();
			await Promise.resolve();
			expect(screen.queryByRole('button', { name: 'xylophone' })).not.toBeInTheDocument();
		});
	});
});
