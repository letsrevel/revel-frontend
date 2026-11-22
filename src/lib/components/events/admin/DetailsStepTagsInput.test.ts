import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DetailsStepTagsInput from './DetailsStepTagsInput.svelte';

const { tagListTags } = vi.hoisted(() => ({ tagListTags: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({ tagListTags }));

function renderInput(onUpdate = vi.fn()) {
	render(DetailsStepTagsInput, {
		props: {
			tags: [],
			tagInput: '',
			tagSuggestions: [],
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
});
