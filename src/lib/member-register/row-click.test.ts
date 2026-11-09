import { describe, expect, it } from 'vitest';
import { rowHasOpenMenu, shouldOpenRow } from './row-click';

function cell(html: string): HTMLElement {
	const row = document.createElement('tr');
	row.innerHTML = html;
	document.body.append(row);
	return row;
}

describe('shouldOpenRow', () => {
	it('opens for a plain click on a cell', () => {
		const row = cell('<td id="c">text</td>');
		expect(shouldOpenRow(row.querySelector('#c'), false, '')).toBe(true);
	});

	it('ignores clicks on buttons, links and menu items', () => {
		const row = cell(
			'<td><button id="b"><span id="i">x</span></button><a id="a" href="#">l</a><div role="menuitem" id="m">m</div></td>'
		);
		for (const id of ['#b', '#i', '#a', '#m']) {
			expect(shouldOpenRow(row.querySelector(id), false, '')).toBe(false);
		}
	});

	it('ignores the click that ends a text selection', () => {
		const row = cell('<td id="c">text</td>');
		expect(shouldOpenRow(row.querySelector('#c'), false, 'ex')).toBe(false);
	});

	it('ignores the click that only dismissed an open menu', () => {
		const row = cell('<td id="c">text</td>');
		expect(shouldOpenRow(row.querySelector('#c'), true, '')).toBe(false);
	});

	it('reads the live selection by default', () => {
		const row = cell('<td id="c">text</td>');
		const range = document.createRange();
		range.selectNodeContents(row.querySelector('#c') as Node);
		window.getSelection()?.removeAllRanges();
		window.getSelection()?.addRange(range);
		expect(shouldOpenRow(row.querySelector('#c'), false)).toBe(false);
		window.getSelection()?.removeAllRanges();
		expect(shouldOpenRow(row.querySelector('#c'), false)).toBe(true);
	});
});

describe('rowHasOpenMenu', () => {
	it('detects an expanded menu trigger inside the row', () => {
		const open = cell('<td><button aria-expanded="true">…</button></td>');
		const closed = cell('<td><button aria-expanded="false">…</button></td>');
		expect(rowHasOpenMenu(open)).toBe(true);
		expect(rowHasOpenMenu(closed)).toBe(false);
	});
});
