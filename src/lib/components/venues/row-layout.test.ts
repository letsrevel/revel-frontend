import { describe, expect, it } from 'vitest';
import {
	defaultRowLayout,
	isDefaultRowLayout,
	parseRowLayout,
	serializeRowLayout,
	CURVE_MAX
} from './row-layout';

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
