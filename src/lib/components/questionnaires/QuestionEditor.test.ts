import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuestionEditor from './QuestionEditor.svelte';

/**
 * Covers the two scoring-weight inputs. `parseFloat('') || 0` snapped an emptied
 * field back to 0 on the keystroke that emptied it, so a weight could only ever
 * be appended to (#924). They are the sweep's only fractional fields.
 */
describe('QuestionEditor — scoring weights', () => {
	let onUpdate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onUpdate = vi.fn();
	});

	async function renderEditor(weights: { positive?: number; negative?: number } = {}) {
		const result = render(QuestionEditor, {
			props: {
				question: {
					id: 'q-1',
					type: 'free_text',
					text: 'Why?',
					required: true,
					order: 0,
					positiveWeight: weights.positive ?? 1,
					negativeWeight: weights.negative ?? 0,
					isFatal: false
				},
				onUpdate,
				onRemove: vi.fn()
			}
		});
		// The weights live in the collapsed "advanced" section.
		await fireEvent.click(screen.getByRole('button', { name: /advanced/i }));
		return result;
	}

	function positiveWeightInput(): HTMLInputElement {
		return screen.getByLabelText(/positive weight/i) as HTMLInputElement;
	}

	function negativeWeightInput(): HTMLInputElement {
		return screen.getByLabelText(/negative weight/i) as HTMLInputElement;
	}

	it('lets a weight be cleared without snapping it to 0', async () => {
		await renderEditor({ positive: 2 });
		const input = positiveWeightInput();
		expect(input.value).toBe('2');

		await fireEvent.input(input, { target: { value: '' } });

		expect(input.value).toBe('');
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('commits a fractional weight typed after clearing', async () => {
		await renderEditor({ positive: 2 });
		const input = positiveWeightInput();

		await fireEvent.input(input, { target: { value: '' } });
		// "0." is not yet a number — it must not commit, and must not be rewritten.
		await fireEvent.input(input, { target: { value: '0.' } });
		expect(onUpdate).not.toHaveBeenCalled();

		await fireEvent.input(input, { target: { value: '0.5' } });
		expect(onUpdate).toHaveBeenLastCalledWith({ positiveWeight: 0.5 });
	});

	it('settles an emptied weight back to the committed value on blur', async () => {
		await renderEditor({ positive: 2 });
		const input = positiveWeightInput();

		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.blur(input);

		expect(input.value).toBe('2');
		expect(onUpdate).toHaveBeenLastCalledWith({ positiveWeight: 2 });
	});

	it('clamps an out-of-range negative weight on blur', async () => {
		await renderEditor({ negative: 1 });
		const input = negativeWeightInput();

		await fireEvent.input(input, { target: { value: '250' } });
		expect(onUpdate).not.toHaveBeenCalled();

		await fireEvent.blur(input);
		expect(onUpdate).toHaveBeenLastCalledWith({ negativeWeight: 100 });
	});
});
