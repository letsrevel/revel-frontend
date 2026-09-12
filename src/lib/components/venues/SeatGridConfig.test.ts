import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import SeatGridConfig from './SeatGridConfig.svelte';

/**
 * The rows/columns inputs never blocked editing, but an emptied field left the
 * display and the grid size diverged with nothing to settle them (#924). They now
 * commit only in-range sizes while typing and normalize on blur.
 */
describe('SeatGridConfig — grid size inputs', () => {
	function renderConfig(
		rows = 5,
		columns = 8
	): ReturnType<typeof render> & {
		onBeforeEdit: ReturnType<typeof vi.fn>;
		rowsInput: HTMLInputElement;
		columnsInput: HTMLInputElement;
	} {
		const onBeforeEdit = vi.fn();
		const result = render(SeatGridConfig, {
			props: {
				rows,
				columns,
				useLetters: true,
				invertRowOrder: false,
				onGenerateEmpty: vi.fn(),
				onGenerateFull: vi.fn(),
				onBeforeEdit
			}
		});
		return {
			...result,
			onBeforeEdit,
			rowsInput: result.getByLabelText(/rows/i) as HTMLInputElement,
			columnsInput: result.getByLabelText(/columns/i) as HTMLInputElement
		};
	}

	it('lets a size be cleared and retyped', async () => {
		const { rowsInput } = renderConfig(5);
		expect(rowsInput.value).toBe('5');

		await fireEvent.input(rowsInput, { target: { value: '' } });
		expect(rowsInput.value).toBe('');

		await fireEvent.input(rowsInput, { target: { value: '12' } });
		expect(rowsInput.value).toBe('12');
	});

	it('opens no undo point for a keystroke that commits nothing', async () => {
		const { rowsInput, onBeforeEdit } = renderConfig(5);

		await fireEvent.input(rowsInput, { target: { value: '' } });

		expect(onBeforeEdit).not.toHaveBeenCalled();
	});

	it('normalizes an emptied field back to the current size on blur', async () => {
		const { columnsInput } = renderConfig(5, 8);

		await fireEvent.input(columnsInput, { target: { value: '' } });
		await fireEvent.blur(columnsInput);

		expect(columnsInput.value).toBe('8');
	});

	it('clamps an oversized value to the grid maximum on blur', async () => {
		const { rowsInput } = renderConfig(5);

		// "300" explodes the synthetic lattice; it is never committed, and blur
		// settles it at the declared maximum rather than rewriting it per keystroke.
		await fireEvent.input(rowsInput, { target: { value: '300' } });
		expect(rowsInput.value).toBe('300');

		await fireEvent.blur(rowsInput);
		expect(rowsInput.value).toBe('30');
	});
});
