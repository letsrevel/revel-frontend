import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import DetailsStepTagsInput from './DetailsStepTagsInput.svelte';

const { tagListTags } = vi.hoisted(() => ({ tagListTags: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({ tagListTags }));

function renderInput(
	onUpdate: Mock = vi.fn(),
	tags: string[] = [],
	tagSuggestions: string[] = []
): { input: HTMLInputElement; onUpdate: Mock } {
	render(DetailsStepTagsInput, {
		props: {
			tags,
			tagInput: '',
			tagSuggestions,
			showSuggestions: false,
			selectedSuggestionIndex: -1,
			onUpdate
		}
	});
	return { input: screen.getByRole('combobox') as HTMLInputElement, onUpdate };
}

async function settle(): Promise<void> {
	await vi.advanceTimersByTimeAsync(400);
}

describe('DetailsStepTagsInput suggestions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		tagListTags.mockReset();
		tagListTags.mockResolvedValue({ data: { results: [{ name: 'music' }] } });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows suggestions for a search typed into the focused input', async () => {
		const { input } = renderInput();
		input.focus();
		await fireEvent.input(input, { target: { value: 'mu' } });
		await settle();

		expect(screen.getByRole('listbox')).toBeInTheDocument();
		expect(screen.getByRole('option', { name: /music/ })).toBeInTheDocument();
	});

	it('does not open the list when the user left the input before the answer', async () => {
		const { input } = renderInput();
		input.focus();
		await fireEvent.input(input, { target: { value: 'mu' } });
		input.blur();
		await settle();

		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
	});

	it('does not open the list after the user added the tag before the search ran', async () => {
		const { input, onUpdate } = renderInput();
		input.focus();
		await fireEvent.input(input, { target: { value: 'jazz' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		await settle();

		expect(onUpdate).toHaveBeenCalledWith({ tags: ['jazz'] });
		expect(tagListTags).not.toHaveBeenCalled();
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
	});

	it('searches again on refocus after an answer was dropped', async () => {
		const { input } = renderInput();
		input.focus();
		await fireEvent.input(input, { target: { value: 'mu' } });
		input.blur();
		await settle();
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

		tagListTags.mockResolvedValue({ data: { results: [{ name: 'musical' }] } });
		input.focus();
		await fireEvent.focus(input);
		await settle();

		expect(screen.getByRole('option', { name: /musical/ })).toBeInTheDocument();
	});

	it('ignores an answer for older text when the user typed more', async () => {
		let resolveOld: ((v: unknown) => void) | undefined;
		tagListTags
			.mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
			.mockResolvedValueOnce({ data: { results: [{ name: 'museum' }] } });
		const { input } = renderInput();
		input.focus();
		await fireEvent.input(input, { target: { value: 'mu' } });
		await settle();
		await fireEvent.input(input, { target: { value: 'mus' } });
		await settle();
		resolveOld?.({ data: { results: [{ name: 'music' }] } });
		await settle();

		expect(screen.queryByRole('option', { name: /music$/ })).not.toBeInTheDocument();
		expect(screen.getByRole('option', { name: /museum/ })).toBeInTheDocument();
	});

	it('keeps the list of a newer search open when an older search fails later', async () => {
		let rejectOld: ((e: unknown) => void) | undefined;
		tagListTags
			.mockImplementationOnce(() => new Promise((_, rej) => (rejectOld = rej)))
			.mockResolvedValueOnce({ data: { results: [{ name: 'museum' }] } });
		const errorSpy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
		const { input } = renderInput();
		input.focus();
		await fireEvent.input(input, { target: { value: 'mu' } });
		await settle();
		await fireEvent.input(input, { target: { value: 'mus' } });
		await settle();
		expect(screen.getByRole('option', { name: /museum/ })).toBeInTheDocument();

		rejectOld?.(new Error('network'));
		await settle();

		expect(screen.getByRole('listbox')).toBeInTheDocument();
		expect(screen.getByRole('option', { name: /museum/ })).toBeInTheDocument();
		errorSpy.mockRestore();
	});

	it('does not reopen the list after Escape, even when the search already started', async () => {
		let resolveSearch: ((v: unknown) => void) | undefined;
		tagListTags.mockImplementationOnce(() => new Promise((r) => (resolveSearch = r)));
		const { input } = renderInput();
		input.focus();
		await fireEvent.input(input, { target: { value: 'mu' } });
		await settle(); // the search is now in flight
		await fireEvent.keyDown(input, { key: 'Escape' });
		resolveSearch?.({ data: { results: [{ name: 'music' }] } });
		await settle();

		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
	});

	it('scrolls the list into view after typing, not after a refocus search', async () => {
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		const { input } = renderInput();
		input.focus();
		await fireEvent.input(input, { target: { value: 'mu' } });
		await settle();
		expect(scroll).toHaveBeenCalledTimes(1);

		input.blur();
		await settle();
		input.focus();
		await fireEvent.focus(input);
		await settle();
		expect(screen.getByRole('listbox')).toBeInTheDocument();
		expect(scroll).toHaveBeenCalledTimes(1);
		// jsdom has no scrollIntoView; remove the stub so other tests see the real shape.
		delete (Element.prototype as Partial<Element>).scrollIntoView;
	});

	describe('spinner', () => {
		const spinner = (): HTMLElement | null => screen.queryByTestId('tag-search-spinner');
		type Resolver = (v: unknown) => void;

		it('stays while the newest search runs after an older one answered', async () => {
			const resolvers: Resolver[] = [];
			tagListTags.mockImplementation(() => new Promise((r) => resolvers.push(r)));
			const { input } = renderInput();
			input.focus();
			await fireEvent.input(input, { target: { value: 'mu' } });
			await settle();
			await fireEvent.input(input, { target: { value: 'mus' } });
			await settle();
			expect(resolvers).toHaveLength(2);

			resolvers[0]({ data: { results: [{ name: 'music' }] } });
			await settle();
			expect(spinner()).toBeInTheDocument();

			resolvers[1]({ data: { results: [{ name: 'museum' }] } });
			await settle();
			expect(spinner()).not.toBeInTheDocument();
		});

		it('goes on Escape and stays gone when the old answer arrives', async () => {
			let resolveSearch: Resolver | undefined;
			tagListTags.mockImplementationOnce(() => new Promise((r) => (resolveSearch = r)));
			const { input } = renderInput();
			input.focus();
			await fireEvent.input(input, { target: { value: 'mu' } });
			await settle();
			expect(spinner()).toBeInTheDocument();

			await fireEvent.keyDown(input, { key: 'Escape' });
			expect(spinner()).not.toBeInTheDocument();
			resolveSearch?.({ data: { results: [{ name: 'music' }] } });
			await settle();
			expect(spinner()).not.toBeInTheDocument();
		});

		it('goes when the user clears the input during a search', async () => {
			let resolveSearch: Resolver | undefined;
			tagListTags.mockImplementationOnce(() => new Promise((r) => (resolveSearch = r)));
			const { input } = renderInput();
			input.focus();
			await fireEvent.input(input, { target: { value: 'mu' } });
			await settle();
			expect(spinner()).toBeInTheDocument();

			await fireEvent.input(input, { target: { value: '' } });
			await settle();
			expect(spinner()).not.toBeInTheDocument();
			resolveSearch?.({ data: { results: [{ name: 'music' }] } });
			await settle();
			expect(spinner()).not.toBeInTheDocument();
		});

		it('goes when the user adds the tag during a search', async () => {
			let resolveSearch: Resolver | undefined;
			tagListTags.mockImplementationOnce(() => new Promise((r) => (resolveSearch = r)));
			const { input } = renderInput();
			input.focus();
			await fireEvent.input(input, { target: { value: 'mu' } });
			await settle();
			expect(spinner()).toBeInTheDocument();

			await fireEvent.keyDown(input, { key: 'Enter' });
			expect(spinner()).not.toBeInTheDocument();
			resolveSearch?.({ data: { results: [{ name: 'music' }] } });
			await settle();
			expect(spinner()).not.toBeInTheDocument();
		});
	});

	describe('letter case and cleaning', () => {
		it('does not add a duplicate that differs in case, and clears the input', async () => {
			const { input, onUpdate } = renderInput(vi.fn(), ['Fun']);
			await fireEvent.input(input, { target: { value: 'fun' } });
			await fireEvent.keyDown(input, { key: 'Enter' });

			expect(onUpdate).not.toHaveBeenCalled();
			expect(input.value).toBe('');
		});

		it('takes the casing of a matching suggestion', async () => {
			const { input, onUpdate } = renderInput(vi.fn(), ['a'], ['Fun']);
			await fireEvent.input(input, { target: { value: 'fun' } });
			await fireEvent.keyDown(input, { key: 'Enter' });

			expect(onUpdate).toHaveBeenCalledWith({ tags: ['a', 'Fun'] });
		});

		it('hides a suggestion that matches an added tag regardless of case', async () => {
			tagListTags.mockResolvedValue({ data: { results: [{ name: 'Fun' }, { name: 'Funk' }] } });
			const { input } = renderInput(vi.fn(), ['fun']);
			input.focus();
			await fireEvent.input(input, { target: { value: 'fu' } });
			await settle();

			expect(screen.getByRole('option', { name: /Funk/ })).toBeInTheDocument();
			expect(screen.queryByRole('option', { name: /^Fun$/ })).not.toBeInTheDocument();
		});

		it('does nothing for an input that is only a hash', async () => {
			const { input, onUpdate } = renderInput();
			await fireEvent.input(input, { target: { value: '#' } });
			await fireEvent.keyDown(input, { key: 'Enter' });

			expect(onUpdate).not.toHaveBeenCalled();
			expect(input.value).toBe('#');
		});
	});
});
