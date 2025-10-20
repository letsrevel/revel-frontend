import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import TagInput from './TagInput.svelte';

describe('TagInput', () => {
	it('renders with label', () => {
		render(TagInput, {
			props: {
				label: 'Event Tags'
			}
		});

		expect(screen.getByLabelText('Event Tags')).toBeInTheDocument();
	});

	it('shows required indicator when required', () => {
		render(TagInput, {
			props: {
				label: 'Tags',
				required: true
			}
		});

		const label = screen.getByText('Tags').parentElement;
		expect(label?.textContent).toContain('*');
	});

	it('displays error message', () => {
		render(TagInput, {
			props: {
				label: 'Tags',
				error: 'At least one tag is required'
			}
		});

		expect(screen.getByRole('alert')).toHaveTextContent('At least one tag is required');
	});

	it('displays existing tags', () => {
		render(TagInput, {
			props: {
				label: 'Tags',
				value: ['Music', 'Food', 'Sports']
			}
		});

		expect(screen.getByText('Music')).toBeInTheDocument();
		expect(screen.getByText('Food')).toBeInTheDocument();
		expect(screen.getByText('Sports')).toBeInTheDocument();
	});

	it('adds tag on Enter key', async () => {
		const user = userEvent.setup();
		const handleTagsChange = vi.fn();

		render(TagInput, {
			props: {
				label: 'Tags',
				onTagsChange: handleTagsChange
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'Music{Enter}');

		expect(handleTagsChange).toHaveBeenCalledWith(['Music']);
	});

	it('adds tag on comma key', async () => {
		const user = userEvent.setup();
		const handleTagsChange = vi.fn();

		render(TagInput, {
			props: {
				label: 'Tags',
				onTagsChange: handleTagsChange
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'Music,');

		expect(handleTagsChange).toHaveBeenCalledWith(['Music']);
	});

	it('removes tag on click', async () => {
		const user = userEvent.setup();
		const handleTagsChange = vi.fn();

		render(TagInput, {
			props: {
				label: 'Tags',
				value: ['Music', 'Food'],
				onTagsChange: handleTagsChange
			}
		});

		const removeButton = screen.getByRole('button', { name: /remove music/i });
		await user.click(removeButton);

		expect(handleTagsChange).toHaveBeenCalledWith(['Food']);
	});

	it('removes last tag on Backspace when input is empty', async () => {
		const user = userEvent.setup();
		const handleTagsChange = vi.fn();

		render(TagInput, {
			props: {
				label: 'Tags',
				value: ['Music', 'Food'],
				onTagsChange: handleTagsChange
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		input.focus();
		await user.keyboard('{Backspace}');

		expect(handleTagsChange).toHaveBeenCalledWith(['Music']);
	});

	it('shows autocomplete suggestions', async () => {
		const user = userEvent.setup();

		render(TagInput, {
			props: {
				label: 'Tags',
				suggestions: ['Music', 'Movies', 'Food', 'Sports']
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'Mu');

		// Should show suggestions containing "Mu"
		expect(screen.getByRole('listbox')).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'Music' })).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'Movies' })).toBeInTheDocument();
	});

	it('selects suggestion on click', async () => {
		const user = userEvent.setup();
		const handleTagsChange = vi.fn();

		render(TagInput, {
			props: {
				label: 'Tags',
				suggestions: ['Music', 'Movies'],
				onTagsChange: handleTagsChange
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'Mu');

		const suggestion = screen.getByRole('option', { name: 'Music' });
		await user.click(suggestion);

		expect(handleTagsChange).toHaveBeenCalledWith(['Music']);
	});

	it('navigates suggestions with arrow keys', async () => {
		const user = userEvent.setup();

		render(TagInput, {
			props: {
				label: 'Tags',
				suggestions: ['Music', 'Movies', 'Food']
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'M');

		// Arrow down to select first suggestion
		await user.keyboard('{ArrowDown}');

		const firstOption = screen.getByRole('option', { name: 'Music' });
		expect(firstOption).toHaveAttribute('aria-selected', 'true');

		// Arrow down to select second suggestion
		await user.keyboard('{ArrowDown}');

		const secondOption = screen.getByRole('option', { name: 'Movies' });
		expect(secondOption).toHaveAttribute('aria-selected', 'true');
	});

	it('selects highlighted suggestion on Enter', async () => {
		const user = userEvent.setup();
		const handleTagsChange = vi.fn();

		render(TagInput, {
			props: {
				label: 'Tags',
				suggestions: ['Music', 'Movies'],
				onTagsChange: handleTagsChange
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'M');
		await user.keyboard('{ArrowDown}'); // Select "Music"
		await user.keyboard('{Enter}');

		expect(handleTagsChange).toHaveBeenCalledWith(['Music']);
	});

	it('prevents duplicate tags', async () => {
		const user = userEvent.setup();
		const handleTagsChange = vi.fn();

		render(TagInput, {
			props: {
				label: 'Tags',
				value: ['Music'],
				onTagsChange: handleTagsChange
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'Music{Enter}');

		// Should not add duplicate
		expect(handleTagsChange).not.toHaveBeenCalled();
	});

	it('respects maxTags limit', async () => {
		const user = userEvent.setup();

		render(TagInput, {
			props: {
				label: 'Tags',
				value: ['Music', 'Food'],
				maxTags: 2
			}
		});

		expect(screen.getByText('(2/2)')).toBeInTheDocument();

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		expect(input).toHaveAttribute('readonly');
	});

	it('filters out already selected tags from suggestions', async () => {
		const user = userEvent.setup();

		render(TagInput, {
			props: {
				label: 'Tags',
				value: ['Music'],
				suggestions: ['Music', 'Movies', 'Food']
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'M');

		// "Music" should not appear in suggestions (already selected)
		expect(screen.queryByRole('option', { name: 'Music' })).not.toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'Movies' })).toBeInTheDocument();
	});

	it('closes suggestions on Escape key', async () => {
		const user = userEvent.setup();

		render(TagInput, {
			props: {
				label: 'Tags',
				suggestions: ['Music', 'Movies']
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, 'M');

		expect(screen.getByRole('listbox')).toBeInTheDocument();

		await user.keyboard('{Escape}');

		// Suggestions should be hidden (with a small delay)
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
	});

	it('respects disabled state', () => {
		render(TagInput, {
			props: {
				label: 'Tags',
				value: ['Music'],
				disabled: true
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		expect(input).toBeDisabled();

		// Remove buttons should not be present when disabled
		expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
	});

	it('trims whitespace from tags', async () => {
		const user = userEvent.setup();
		const handleTagsChange = vi.fn();

		render(TagInput, {
			props: {
				label: 'Tags',
				onTagsChange: handleTagsChange
			}
		});

		const input = screen.getByLabelText('Tags') as HTMLInputElement;
		await user.type(input, '  Music  {Enter}');

		expect(handleTagsChange).toHaveBeenCalledWith(['Music']);
	});

	it('is keyboard accessible', () => {
		render(TagInput, {
			props: {
				label: 'Tags',
				value: ['Music']
			}
		});

		const input = screen.getByLabelText('Tags');
		expect(input).toBeInstanceOf(HTMLInputElement);

		// Tag chips should be keyboard accessible
		const tagChip = screen.getByText('Music').closest('[role="button"]');
		expect(tagChip).toHaveAttribute('tabindex', '0');
	});
});
