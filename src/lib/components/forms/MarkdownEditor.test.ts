import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import MarkdownEditor from './MarkdownEditor.svelte';

describe('MarkdownEditor', () => {
	it('renders with label', () => {
		render(MarkdownEditor, {
			props: {
				label: 'Event Description'
			}
		});

		expect(screen.getByLabelText('Event Description')).toBeInTheDocument();
	});

	it('shows required indicator when required', () => {
		render(MarkdownEditor, {
			props: {
				label: 'Description',
				required: true
			}
		});

		const label = screen.getByText('Description').parentElement;
		expect(label?.textContent).toContain('*');
	});

	it('displays error message', () => {
		render(MarkdownEditor, {
			props: {
				label: 'Description',
				error: 'Description is required'
			}
		});

		expect(screen.getByRole('alert')).toHaveTextContent('Description is required');
	});

	it('accepts initial value', () => {
		const initialValue = '# Hello World\n\nThis is **bold** text.';

		render(MarkdownEditor, {
			props: {
				value: initialValue,
				label: 'Description'
			}
		});

		const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
		expect(textarea.value).toBe(initialValue);
	});

	it('calls onValueChange when value changes', async () => {
		const user = userEvent.setup();
		const handleChange = vi.fn();

		render(MarkdownEditor, {
			props: {
				label: 'Description',
				onValueChange: handleChange
			}
		});

		const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
		await user.type(textarea, 'Test content');

		expect(handleChange).toHaveBeenCalled();
	});

	it('toggles preview mode', async () => {
		const user = userEvent.setup();

		render(MarkdownEditor, {
			props: {
				label: 'Description',
				value: '# Hello World'
			}
		});

		// Initially should show textarea
		expect(screen.getByLabelText('Description')).toBeInTheDocument();

		// Click preview button
		const previewButton = screen.getByRole('button', { name: /show preview/i });
		await user.click(previewButton);

		// Textarea should be hidden, preview should be visible
		expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /hide preview/i })).toBeInTheDocument();
	});

	it('renders markdown in preview mode', async () => {
		const user = userEvent.setup();

		render(MarkdownEditor, {
			props: {
				label: 'Description',
				value: '# Hello World\n\nThis is **bold** text.'
			}
		});

		// Toggle preview
		const previewButton = screen.getByRole('button', { name: /show preview/i });
		await user.click(previewButton);

		// Check that markdown is converted to HTML (basic check)
		const preview = document.querySelector('.prose');
		expect(preview).toBeInTheDocument();
		expect(preview?.innerHTML).toContain('Hello World');
	});

	it('shows formatting toolbar when not in preview mode', () => {
		render(MarkdownEditor, {
			props: {
				label: 'Description'
			}
		});

		expect(screen.getByRole('toolbar', { name: /markdown formatting/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
	});

	it('hides formatting toolbar in preview mode', async () => {
		const user = userEvent.setup();

		render(MarkdownEditor, {
			props: {
				label: 'Description',
				value: 'Test'
			}
		});

		// Toggle preview
		const previewButton = screen.getByRole('button', { name: /show preview/i });
		await user.click(previewButton);

		expect(screen.queryByRole('toolbar', { name: /markdown formatting/i })).not.toBeInTheDocument();
	});

	it('respects disabled state', () => {
		render(MarkdownEditor, {
			props: {
				label: 'Description',
				disabled: true
			}
		});

		const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
		expect(textarea).toBeDisabled();
	});

	it('sets aria-invalid when error is present', () => {
		render(MarkdownEditor, {
			props: {
				label: 'Description',
				error: 'Invalid content'
			}
		});

		const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
		expect(textarea).toHaveAttribute('aria-invalid', 'true');
	});

	it('respects rows prop', () => {
		render(MarkdownEditor, {
			props: {
				label: 'Description',
				rows: 10
			}
		});

		const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
		expect(textarea.rows).toBe(10);
	});

	it('is keyboard accessible', () => {
		render(MarkdownEditor, {
			props: {
				label: 'Description'
			}
		});

		const textarea = screen.getByLabelText('Description');
		expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
	});
});
