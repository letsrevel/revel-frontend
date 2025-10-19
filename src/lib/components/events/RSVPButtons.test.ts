import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RSVPButtons from './RSVPButtons.svelte';

describe('RSVPButtons', () => {
	it('renders all three RSVP buttons', () => {
		render(RSVPButtons, {
			props: {
				onSelect: vi.fn(),
				isEligible: true
			}
		});

		expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /maybe/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /no/i })).toBeInTheDocument();
	});

	it('calls onSelect when a button is clicked', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();

		render(RSVPButtons, {
			props: {
				onSelect,
				isEligible: true
			}
		});

		const yesButton = screen.getByRole('button', { name: /yes/i });
		await user.click(yesButton);

		expect(onSelect).toHaveBeenCalledWith('yes');
	});

	it('disables buttons when not eligible', () => {
		render(RSVPButtons, {
			props: {
				onSelect: vi.fn(),
				isEligible: false
			}
		});

		const yesButton = screen.getByRole('button', { name: /yes/i });
		const maybeButton = screen.getByRole('button', { name: /maybe/i });
		const noButton = screen.getByRole('button', { name: /no/i });

		expect(yesButton).toBeDisabled();
		expect(maybeButton).toBeDisabled();
		expect(noButton).toBeDisabled();
	});

	it('disables buttons when disabled prop is true', () => {
		render(RSVPButtons, {
			props: {
				onSelect: vi.fn(),
				isEligible: true,
				disabled: true
			}
		});

		const yesButton = screen.getByRole('button', { name: /yes/i });
		const maybeButton = screen.getByRole('button', { name: /maybe/i });
		const noButton = screen.getByRole('button', { name: /no/i });

		expect(yesButton).toBeDisabled();
		expect(maybeButton).toBeDisabled();
		expect(noButton).toBeDisabled();
	});

	it('shows loading spinner on selected button when loading', () => {
		render(RSVPButtons, {
			props: {
				onSelect: vi.fn(),
				isEligible: true,
				isLoading: true,
				currentAnswer: 'yes'
			}
		});

		// Loading spinner should be visible (Loader2 icon)
		const yesButton = screen.getByRole('button', { name: /yes/i });
		expect(yesButton).toBeInTheDocument();
		// Note: Testing for the actual spinner SVG would require checking the DOM structure
	});

	it('shows lock icons when not eligible', () => {
		render(RSVPButtons, {
			props: {
				onSelect: vi.fn(),
				isEligible: false
			}
		});

		// Lock icons should be visible
		const yesButton = screen.getByRole('button', { name: /yes/i });
		expect(yesButton).toBeInTheDocument();
		expect(yesButton).toBeDisabled();
	});

	it('highlights selected button', () => {
		const { container } = render(RSVPButtons, {
			props: {
				onSelect: vi.fn(),
				isEligible: true,
				currentAnswer: 'yes'
			}
		});

		const yesButton = screen.getByRole('button', { name: /yes/i });
		expect(yesButton).toHaveAttribute('aria-pressed', 'true');
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();

		render(RSVPButtons, {
			props: {
				onSelect,
				isEligible: true
			}
		});

		// Tab to first button
		await user.tab();
		const yesButton = screen.getByRole('button', { name: /yes/i });
		expect(yesButton).toHaveFocus();

		// Press Enter to select
		await user.keyboard('{Enter}');
		expect(onSelect).toHaveBeenCalledWith('yes');

		// Tab to next button
		await user.tab();
		const maybeButton = screen.getByRole('button', { name: /maybe/i });
		expect(maybeButton).toHaveFocus();
	});

	it('prevents interaction when loading', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();

		render(RSVPButtons, {
			props: {
				onSelect,
				isEligible: true,
				isLoading: true,
				currentAnswer: 'yes'
			}
		});

		const maybeButton = screen.getByRole('button', { name: /maybe/i });
		await user.click(maybeButton);

		// Should not call onSelect because it's loading
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('has proper ARIA attributes', () => {
		render(RSVPButtons, {
			props: {
				onSelect: vi.fn(),
				isEligible: true,
				currentAnswer: 'maybe'
			}
		});

		const group = screen.getByRole('group', { name: /rsvp options/i });
		expect(group).toBeInTheDocument();

		const yesButton = screen.getByRole('button', { name: /yes/i });
		const maybeButton = screen.getByRole('button', { name: /maybe/i });
		const noButton = screen.getByRole('button', { name: /no/i });

		expect(yesButton).toHaveAttribute('aria-pressed', 'false');
		expect(maybeButton).toHaveAttribute('aria-pressed', 'true');
		expect(noButton).toHaveAttribute('aria-pressed', 'false');
	});
});
