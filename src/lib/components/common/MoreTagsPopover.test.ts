import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import MoreTagsPopover from './MoreTagsPopover.svelte';

describe('MoreTagsPopover', () => {
	it('renders a button whose accessible name starts with the visible text and a visible +N label', () => {
		render(MoreTagsPopover, { props: { tags: ['a', 'b', 'c'] } });
		const trigger = screen.getByRole('button', { name: '+3 more tags' });
		expect(trigger).toHaveTextContent('+3 more');
		expect(trigger).not.toHaveAttribute('aria-label');
		// WCAG 2.5.3: the accessible name starts with the visible text.
		expect(trigger.textContent?.startsWith('+3 more')).toBe(true);
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('uses the singular name for one hidden tag', () => {
		render(MoreTagsPopover, { props: { tags: ['solo'] } });
		expect(screen.getByRole('button', { name: '+1 more tag' })).toBeInTheDocument();
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
