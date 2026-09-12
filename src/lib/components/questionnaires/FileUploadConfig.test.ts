import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileUploadConfig from './FileUploadConfig.svelte';

/**
 * Covers the "max number of files" input only — the shared guard's own semantics
 * live in `src/lib/utils/numeric-input.test.ts`. Before #924 this field carried
 * both halves of the anti-pattern: a `maxFiles || 1` display AND a per-keystroke
 * clamp, so typing "12" became "10" the instant the 2 landed.
 */
describe('FileUploadConfig — max number of files', () => {
	let onUpdate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onUpdate = vi.fn();
	});

	function renderConfig(maxFiles = 1) {
		return render(FileUploadConfig, {
			props: {
				questionId: 'q-1',
				allowedMimeTypes: ['image/png'],
				maxFileSize: 1048576,
				maxFiles,
				onUpdate
			}
		});
	}

	function maxFilesInput(): HTMLInputElement {
		return screen.getByLabelText(/max(imum)? number of files/i) as HTMLInputElement;
	}

	it('lets the field be cleared instead of refilling it with 1', async () => {
		renderConfig(1);
		const input = maxFilesInput();
		expect(input.value).toBe('1');

		await fireEvent.input(input, { target: { value: '' } });

		expect(input.value).toBe('');
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('accepts a replacement typed after clearing', async () => {
		renderConfig(1);
		const input = maxFilesInput();

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.input(input, { target: { value: '5' } });

		expect(input.value).toBe('5');
		expect(onUpdate).toHaveBeenLastCalledWith({ maxFiles: 5 });
	});

	it('does not rewrite a transient out-of-range value mid-typing', async () => {
		renderConfig(1);
		const input = maxFilesInput();

		// "12" used to snap to "10" on the keystroke, stranding the caret.
		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.input(input, { target: { value: '12' } });

		expect(input.value).toBe('12');
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('clamps to the 1..10 range on blur', async () => {
		renderConfig(1);
		const input = maxFilesInput();

		await fireEvent.input(input, { target: { value: '12' } });
		await fireEvent.blur(input);

		expect(onUpdate).toHaveBeenLastCalledWith({ maxFiles: 10 });
	});

	it('settles an emptied field back to the committed value on blur', async () => {
		renderConfig(4);
		const input = maxFilesInput();

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.blur(input);

		// Releasing the buffer restores the display on its own — nothing changed,
		// so nothing is written back.
		expect(input.value).toBe('4');
		expect(onUpdate).not.toHaveBeenCalled();
	});
});
