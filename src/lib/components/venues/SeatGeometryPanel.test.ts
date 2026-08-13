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

	it('associates the curve help text with both curve inputs via aria-describedby', () => {
		const { getByLabelText, container } = render(SeatGeometryPanel, {
			recipe: defaultRowLayout(),
			rowOptions: [],
			unsupported: false
		});

		const slider = getByLabelText('Curve') as HTMLInputElement;
		const exactInput = getByLabelText('Exact curve value') as HTMLInputElement;
		const help = container.querySelector('#geo-curve-help');

		expect(help).toBeTruthy();
		expect(slider.getAttribute('aria-describedby')).toBe('geo-curve-help');
		expect(exactInput.getAttribute('aria-describedby')).toBe('geo-curve-help');
	});

	it('clamps a typed out-of-range curve value instead of applying it verbatim', async () => {
		const user = userEvent.setup();
		const { getByLabelText } = render(SeatGeometryPanel, {
			recipe: defaultRowLayout(),
			rowOptions: [],
			unsupported: false
		});

		const slider = getByLabelText('Curve') as HTMLInputElement;
		const exactInput = getByLabelText('Exact curve value') as HTMLInputElement;

		await user.clear(exactInput);
		await user.type(exactInput, '999');

		expect(slider.value).toBe('30');
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

	it('shows the desynced-recipe warning banner without disabling any control', () => {
		const { getByRole, getByLabelText } = render(SeatGeometryPanel, {
			recipe: defaultRowLayout(),
			rowOptions: [],
			unsupported: false,
			desynced: true
		});
		expect(getByRole('alert').textContent).toContain('custom positions');
		// Warning only — the admin must still be able to save from this screen.
		expect((getByLabelText('Curve') as HTMLInputElement).disabled).toBe(false);
	});

	it('omits the desynced banner by default', () => {
		const { queryByRole } = render(SeatGeometryPanel, {
			recipe: defaultRowLayout(),
			rowOptions: [],
			unsupported: false
		});
		expect(queryByRole('alert')).toBeNull();
	});

	// Positive curve always displaces rows toward +y; which side of the room
	// that is depends on the inversion, so the help text has to flip with it.
	it('flips the curve help text for an inverted sector', () => {
		const props = { recipe: defaultRowLayout(), rowOptions: [], unsupported: false };
		const normal = render(SeatGeometryPanel, props);
		expect(normal.container.querySelector('#geo-curve-help')?.textContent).toContain(
			'away from the stage'
		);
		normal.unmount();

		const inverted = render(SeatGeometryPanel, { ...props, invertRowOrder: true });
		expect(inverted.container.querySelector('#geo-curve-help')?.textContent).toContain(
			'toward the stage'
		);
	});
});
