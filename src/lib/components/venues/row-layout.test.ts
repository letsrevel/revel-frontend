import { describe, expect, it } from 'vitest';
import {
	defaultRowLayout,
	hasCustomSeatPositions,
	isDefaultRowLayout,
	parseRowLayout,
	resolveRowLayoutForSave,
	serializeRowLayout,
	CURVE_MAX
} from './row-layout';

describe('hasCustomSeatPositions', () => {
	it('is false for an empty sector and for seats with no position', () => {
		expect(hasCustomSeatPositions([])).toBe(false);
		expect(hasCustomSeatPositions([{}, { position: null }])).toBe(false);
	});

	it('is false for a plain grid (whole-unit cell + aisle-shift positions)', () => {
		expect(
			hasCustomSeatPositions([
				{ position: { x: 0, y: 0 } },
				{ position: { x: 6, y: 2 } },
				{ position: { x: -1, y: 0 } }
			])
		).toBe(false);
	});

	it('is true when any seat is off the integer lattice', () => {
		// A curved/staggered bake — the seats-ok/metadata-failed fingerprint.
		expect(
			hasCustomSeatPositions([{ position: { x: 0, y: 0 } }, { position: { x: 1.5, y: 0 } }])
		).toBe(true);
		expect(hasCustomSeatPositions([{ position: { x: 2, y: 0.437 } }])).toBe(true);
	});

	it('treats a non-finite coordinate as custom', () => {
		expect(hasCustomSeatPositions([{ position: { x: Number.NaN, y: 0 } }])).toBe(true);
		expect(hasCustomSeatPositions([{ position: { x: 0, y: Number.POSITIVE_INFINITY } }])).toBe(
			true
		);
	});
});

describe('parseRowLayout', () => {
	it('returns absent when metadata has no rowLayout key', () => {
		expect(parseRowLayout(null).status).toBe('absent');
		expect(parseRowLayout({}).status).toBe('absent');
		expect(parseRowLayout({ aisles: {} }).status).toBe('absent');
	});

	it('returns unsupported for an unknown version or kind', () => {
		expect(parseRowLayout({ rowLayout: { version: 99, kind: 'rows' } }).status).toBe('unsupported');
		expect(parseRowLayout({ rowLayout: { version: 1, kind: 'boxRing' } }).status).toBe(
			'unsupported'
		);
		expect(parseRowLayout({ rowLayout: 'garbage' }).status).toBe('unsupported');
	});

	it('parses a valid recipe and fills defaults for missing fields', () => {
		const parsed = parseRowLayout({ rowLayout: { version: 1, kind: 'rows', curve: 4 } });
		expect(parsed.status).toBe('ok');
		if (parsed.status !== 'ok') return;
		expect(parsed.recipe.curve).toBe(4);
		expect(parsed.recipe.stagger).toBe(0);
		expect(parsed.recipe.align).toBe('left');
		expect(parsed.recipe.rowOverrides).toEqual([]);
	});

	it('clamps out-of-range numbers and drops malformed overrides', () => {
		const parsed = parseRowLayout({
			rowLayout: {
				version: 1,
				kind: 'rows',
				curve: 999,
				stagger: -5,
				align: 'diagonal',
				rowOverrides: [{ row: 2, curve: -999 }, { row: 'x' }, null, { row: 3, dx: 100 }]
			}
		});
		expect(parsed.status).toBe('ok');
		if (parsed.status !== 'ok') return;
		expect(parsed.recipe.curve).toBe(CURVE_MAX);
		expect(parsed.recipe.stagger).toBe(-1);
		expect(parsed.recipe.align).toBe('left');
		expect(parsed.recipe.rowOverrides).toEqual([
			{ row: 2, curve: -30 },
			{ row: 3, dx: 20 }
		]);
	});

	it('preserves unknown sibling keys through serialize (forward compat)', () => {
		const parsed = parseRowLayout({
			rowLayout: { version: 1, kind: 'rows', curve: 2, futureKnob: 'keep-me' }
		});
		expect(parsed.status).toBe('ok');
		if (parsed.status !== 'ok') return;
		const out = serializeRowLayout(parsed.recipe, parsed.raw);
		expect(out?.futureKnob).toBe('keep-me');
		expect(out?.curve).toBe(2);
	});
});

describe('serializeRowLayout / isDefaultRowLayout', () => {
	it('a default recipe serializes to undefined (key removed)', () => {
		expect(isDefaultRowLayout(defaultRowLayout())).toBe(true);
		expect(serializeRowLayout(defaultRowLayout())).toBeUndefined();
	});

	it('a non-default recipe round-trips through parse', () => {
		const recipe = {
			...defaultRowLayout(),
			curve: 6.4,
			align: 'center' as const,
			rowOverrides: [{ row: 1, dy: 0.5 }]
		};
		expect(isDefaultRowLayout(recipe)).toBe(false);
		const parsed = parseRowLayout({ rowLayout: serializeRowLayout(recipe) });
		expect(parsed.status).toBe('ok');
		if (parsed.status !== 'ok') return;
		expect(parsed.recipe).toEqual(recipe);
	});
});

describe('resolveRowLayoutForSave', () => {
	it('preserves an untouched unsupported blob byte-for-byte (regression: any save must not destroy a newer-format recipe)', () => {
		const untouchedBlob = { version: 2, kind: 'polar', futureField: 'keep-me' };
		const result = resolveRowLayoutForSave(
			defaultRowLayout(),
			undefined,
			/* unsupported */ true,
			untouchedBlob
		);
		expect(result).toBe(untouchedBlob);
	});

	it('preserves a non-object unsupported blob too (parseRowLayout can flag a string/array as unsupported)', () => {
		const result = resolveRowLayoutForSave(defaultRowLayout(), undefined, true, 'garbage');
		expect(result).toBe('garbage');
	});

	it('overwrites the unsupported blob once the admin edits the recipe away from default', () => {
		const untouchedBlob = { version: 2, kind: 'polar' };
		const editedRecipe = { ...defaultRowLayout(), curve: 6 };
		const result = resolveRowLayoutForSave(editedRecipe, undefined, true, untouchedBlob);
		expect(result).toEqual(serializeRowLayout(editedRecipe));
		expect(result).not.toBe(untouchedBlob);
	});

	it('falls back to normal serialize behavior when the recipe was never unsupported', () => {
		expect(
			resolveRowLayoutForSave(defaultRowLayout(), undefined, false, undefined)
		).toBeUndefined();
		const recipe = { ...defaultRowLayout(), curve: 3 };
		expect(resolveRowLayoutForSave(recipe, undefined, false, undefined)).toEqual(
			serializeRowLayout(recipe)
		);
	});
});
