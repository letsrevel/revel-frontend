import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import EditorSectionNav from './EditorSectionNav.svelte';

const sections = [{ id: 'basics', label: 'Basics' }];

describe('EditorSectionNav tab entries', () => {
	it('renders no tab buttons when none are given', () => {
		render(EditorSectionNav, { sections, variant: 'list' });
		expect(screen.queryAllByRole('button')).toHaveLength(0);
		expect(screen.getByRole('link', { name: 'Basics' })).toBeInTheDocument();
	});

	it('renders tab entries as buttons and reports the selection', async () => {
		const onTab = vi.fn();
		render(EditorSectionNav, {
			sections,
			variant: 'list',
			tabs: [
				{ value: 'ticketing', label: 'Ticketing' },
				{ value: 'listings', label: 'Listings' }
			],
			onTab
		});
		await userEvent.click(screen.getByRole('button', { name: 'Ticketing' }));
		expect(onTab).toHaveBeenCalledWith('ticketing');
		expect(screen.getByRole('separator')).toBeInTheDocument();
	});

	it('marks the current tab with aria-current=page', () => {
		render(EditorSectionNav, {
			sections: [],
			variant: 'chips',
			tabs: [
				{ value: 'details', label: 'Details' },
				{ value: 'ticketing', label: 'Ticketing', current: true }
			]
		});
		expect(screen.getByRole('button', { name: 'Ticketing' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(screen.queryByRole('separator')).toBeNull();
	});
});

describe('EditorSectionNav scroll-spy click lock', () => {
	it('keeps the clicked section active until the user scrolls by hand', async () => {
		const els = ['a', 'b'].map((id) => {
			const el = document.createElement('div');
			el.id = id;
			el.tabIndex = -1;
			el.scrollIntoView = vi.fn();
			document.body.appendChild(el);
			return el;
		});
		// Pretend the page is scrollable and already at the bottom, with both sections
		// below the 30% line: the at-bottom rule would pick "b".
		Object.defineProperty(document.documentElement, 'scrollHeight', {
			value: 5000,
			configurable: true
		});
		window.scrollY = 5000 - window.innerHeight;
		els.forEach((el) => (el.getBoundingClientRect = () => ({ top: 9999 }) as DOMRect));

		render(EditorSectionNav, {
			sections: [
				{ id: 'a', label: 'Alpha' },
				{ id: 'b', label: 'Beta' }
			],
			variant: 'list'
		});
		expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('aria-current', 'location');

		await userEvent.click(screen.getByRole('link', { name: 'Alpha' }));
		window.dispatchEvent(new Event('scroll'));
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('aria-current', 'location');

		window.dispatchEvent(new Event('wheel'));
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('aria-current', 'location');

		els.forEach((el) => el.remove());
	});
});

describe('EditorSectionNav tab error dot', () => {
	it('flags a tab with validation errors for assistive tech', () => {
		render(EditorSectionNav, {
			sections: [],
			variant: 'list',
			tabs: [
				{ value: 'details', label: 'Details', hasError: true },
				{ value: 'ticketing', label: 'Ticketing', current: true }
			]
		});
		const details = screen.getByRole('button', { name: /Details/ });
		expect(details.querySelector('.bg-destructive')).not.toBeNull();
		expect(
			screen.getByRole('button', { name: /Ticketing/ }).querySelector('.bg-destructive')
		).toBeNull();
	});
});
