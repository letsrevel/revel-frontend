import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CopyField from './CopyField.svelte';

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: toastMock }));

describe('CopyField', () => {
	beforeEach(() => {
		toastMock.success.mockReset();
		toastMock.error.mockReset();
	});

	it('renders a read-only input named by the label and a copy button named with it', () => {
		render(CopyField, { props: { value: 'abc-123', label: 'Client ID' } });
		const input = screen.getByRole('textbox', { name: 'Client ID' }) as HTMLInputElement;
		expect(input.value).toBe('abc-123');
		expect(input).toHaveAttribute('readonly');
		expect(screen.getByRole('button', { name: 'Copy Client ID' })).toBeInTheDocument();
	});

	it('copies the value and toasts on success', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, { clipboard: { writeText } });
		render(CopyField, { props: { value: 'abc-123', label: 'Client ID' } });
		await userEvent.click(screen.getByRole('button', { name: 'Copy Client ID' }));
		expect(writeText).toHaveBeenCalledWith('abc-123');
		await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
	});

	it('toasts an error when the clipboard refuses', async () => {
		Object.assign(navigator, {
			clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
		});
		render(CopyField, { props: { value: 'abc-123', label: 'Client ID' } });
		await userEvent.click(screen.getByRole('button', { name: 'Copy Client ID' }));
		await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
	});
});
