import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import NeedsAttention from './NeedsAttention.svelte';
import AddPersonMenu from './AddPersonMenu.svelte';
import PeopleChips from './PeopleChips.svelte';
import { PEOPLE_VIEWS } from '$lib/member-register/people-view';

describe('NeedsAttention', () => {
	const props = (duplicatesCount: number, applicationsCount: number) => ({
		duplicatesCount,
		applicationsCount,
		onReviewDuplicates: vi.fn(),
		onReviewApplications: vi.fn()
	});

	it('renders nothing when there is nothing to handle', () => {
		render(NeedsAttention, { props: props(0, 0) });
		expect(screen.queryByTestId('needs-attention')).not.toBeInTheDocument();
		expect(screen.queryByRole('region')).not.toBeInTheDocument();
	});

	it('shows a labelled region with only the items that have counts', () => {
		render(NeedsAttention, { props: props(3, 0) });
		const region = screen.getByRole('region', { name: 'Needs attention' });
		expect(region).toBeInTheDocument();
		expect(screen.getByTestId('attention-duplicates')).toHaveTextContent('3');
		expect(screen.queryByTestId('attention-applications')).not.toBeInTheDocument();
		// A region present on load, never a live region.
		expect(region).not.toHaveAttribute('aria-live');
	});

	it('shows both items and wires each Review action', async () => {
		const p = props(2, 5);
		render(NeedsAttention, { props: p });
		expect(screen.getByTestId('attention-duplicates')).toHaveTextContent('2');
		expect(screen.getByTestId('attention-applications')).toHaveTextContent('5');
		await userEvent.click(screen.getByTestId('attention-review-duplicates'));
		expect(p.onReviewDuplicates).toHaveBeenCalledTimes(1);
		await userEvent.click(screen.getByTestId('attention-review-applications'));
		expect(p.onReviewApplications).toHaveBeenCalledTimes(1);
	});
});

describe('AddPersonMenu', () => {
	it('offers adding to the register and creating an invite link', async () => {
		const onAddToRegister = vi.fn();
		const onCreateInviteLink = vi.fn();
		render(AddPersonMenu, {
			props: { onAddToRegister, onAddByAccount: vi.fn(), onCreateInviteLink }
		});
		screen.getByTestId('add-person').focus();
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(screen.queryAllByRole('menuitem', { hidden: true }).length).toBeGreaterThan(0)
		);
		const items = screen
			.queryAllByRole('menuitem', { hidden: true })
			.map((el) => el.textContent?.trim());
		expect(items).toEqual(['Add to register', 'Add by account', 'Create invite link']);
		await userEvent.click(screen.getByTestId('add-to-register'));
		expect(onAddToRegister).toHaveBeenCalledTimes(1);
		document.body.style.pointerEvents = '';
	});
});

describe('PeopleChips', () => {
	it('is a group of toggle buttons with exactly the active one pressed', async () => {
		const onChange = vi.fn();
		render(PeopleChips, { props: { value: 'current', onChange } });
		const group = screen.getByRole('group', { name: 'Show' });
		expect(group).toBeInTheDocument();
		const buttons = screen.getAllByRole('button');
		expect(buttons.map((b) => b.textContent?.trim())).toEqual([
			'Current',
			'Day members',
			'Ended',
			'No account',
			'Everyone'
		]);
		expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
		expect(screen.getByRole('button', { name: 'Current' })).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(screen.getByRole('button', { name: 'Ended' }));
		expect(onChange).toHaveBeenCalledWith('ended');
		expect(PEOPLE_VIEWS).toHaveLength(buttons.length);
	});

	it('wraps instead of scrolling sideways, so no chip is clipped on a phone', () => {
		render(PeopleChips, { props: { value: 'current', onChange: vi.fn() } });
		const group = screen.getByRole('group', { name: 'Show' });
		expect(group.className).toContain('flex-wrap');
		expect(group.className).not.toMatch(/overflow-x-(auto|scroll)|overflow-hidden|nowrap/);
		for (const chip of screen.getAllByRole('button')) {
			expect(chip.className).not.toContain('shrink-0');
		}
	});

	it('presses none when the filters match no chip', () => {
		render(PeopleChips, { props: { value: null, onChange: vi.fn() } });
		expect(
			screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
		).toHaveLength(0);
	});
});
