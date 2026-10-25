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
