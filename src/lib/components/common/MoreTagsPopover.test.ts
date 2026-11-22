import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import MoreTagsPopover from './MoreTagsPopover.svelte';

describe('MoreTagsPopover', () => {
	it('accessible name equals the visible text (count 3)', () => {
		render(MoreTagsPopover, { props: { tags: ['a', 'b', 'c'] } });
		const trigger = screen.getByRole('button', { name: '+3 more tags' });
		expect(trigger.textContent?.trim()).toBe('+3 more tags');
		expect(trigger).not.toHaveAttribute('aria-label');
		expect(trigger.querySelector('.sr-only')).toBeNull();
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('uses the singular name for one hidden tag', () => {
		render(MoreTagsPopover, { props: { tags: ['solo'] } });
		const trigger = screen.getByRole('button', { name: '+1 more tag' });
		expect(trigger.textContent?.trim()).toBe('+1 more tag');
	});

	it('opens on click and lists the hidden tags', async () => {
		const user = userEvent.setup();
		render(MoreTagsPopover, { props: { tags: ['alpha', 'beta'] } });
		expect(screen.queryByText('alpha')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: '+2 more tags' }));
		expect(screen.getByText('alpha')).toBeInTheDocument();
		expect(screen.getByText('beta')).toBeInTheDocument();
		expect(screen.getByLabelText('Remaining tags')).toBeInTheDocument();
	});

	it('opens with the keyboard and closes on Escape, returning focus to the trigger', async () => {
		const user = userEvent.setup();
		render(MoreTagsPopover, { props: { tags: ['alpha', 'beta'] } });
		const trigger = screen.getByRole('button', { name: '+2 more tags' });

		trigger.focus();
		await user.keyboard('{Enter}');
		expect(screen.getByText('alpha')).toBeInTheDocument();

		await user.keyboard('{Escape}');
		expect(screen.queryByText('alpha')).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});

	it('renders nothing when there are no hidden tags', () => {
		render(MoreTagsPopover, { props: { tags: [] } });
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
