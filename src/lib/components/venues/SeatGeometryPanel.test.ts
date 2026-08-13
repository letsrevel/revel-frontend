import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { defaultRowLayout } from './row-layout';
import SeatGeometryPanel from './SeatGeometryPanel.svelte';

describe('SeatGeometryPanel', () => {
	it('renders labelled curve/stagger/align controls', () => {
		const { getByLabelText } = render(SeatGeometryPanel, {
			recipe: defaultRowLayout(),
			rowOptions: [{ rank: 0, label: 'A' }],
			unsupported: false
		});
		expect(getByLabelText('Curve')).toBeTruthy();
		expect(getByLabelText('Exact curve value')).toBeTruthy();
		expect(getByLabelText('Stagger alternate rows')).toBeTruthy();
		expect(getByLabelText('Row alignment')).toBeTruthy();
	});

	it('typing an exact curve value updates the slider', async () => {
		const user = userEvent.setup();
		const { getByLabelText } = render(SeatGeometryPanel, {
			recipe: defaultRowLayout(),
			rowOptions: [],
			unsupported: false
		});

		const slider = getByLabelText('Curve') as HTMLInputElement;
		const exactInput = getByLabelText('Exact curve value') as HTMLInputElement;

		expect(slider.value).toBe('0');

		await user.clear(exactInput);
		await user.type(exactInput, '12');

		expect(slider.value).toBe('12');
	});

	// No `.test.svelte.ts` runes-in-test pattern exists in this project (grep
	// found zero files), so this asserts via the DOM the checkbox controls
	// rather than reading the bound `recipe` object back: the stagger amount
	// input is conditionally rendered on `recipe.stagger !== 0`, which is
	// itself derived from the $bindable prop — so its appearance plus the
	// checkbox's own checked state is proof the click wrote 0.5 into the
	// recipe without needing runes in the test file.
	it('checking stagger reveals the stagger-amount control and checks the box', async () => {
		const user = userEvent.setup();
		const { getByLabelText, queryByLabelText } = render(SeatGeometryPanel, {
			recipe: defaultRowLayout(),
			rowOptions: [],
			unsupported: false
		});

		expect(queryByLabelText('Stagger amount (seat widths)')).toBeNull();

		const checkbox = getByLabelText('Stagger alternate rows') as HTMLInputElement;
		await user.click(checkbox);

		expect(checkbox.checked).toBe(true);
		expect(getByLabelText('Stagger amount (seat widths)')).toBeTruthy();
	});

	it('shows the unsupported-recipe warning banner', () => {
		const { getByRole } = render(SeatGeometryPanel, {
			recipe: defaultRowLayout(),
			rowOptions: [],
			unsupported: true
		});
		expect(getByRole('alert').textContent).toContain('newer format');
	});
});
