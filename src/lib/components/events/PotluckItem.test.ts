import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import PotluckItem from './PotluckItem.svelte';
import type { PotluckItemRetrieveSchema } from '$lib/api/generated/types.gen';

describe('PotluckItem', () => {
	const mockItem: PotluckItemRetrieveSchema = {
		id: '123e4567-e89b-12d3-a456-426614174000',
		name: 'Pasta Salad',
		item_type: 'side_dish',
		quantity: 'Serves 8',
		note_html: '<p>Optional note: Gluten-free pasta</p>',
		is_assigned: false,
		is_owned: false
	};

	const mockClaimedByOther: PotluckItemRetrieveSchema = {
		...mockItem,
		id: '123e4567-e89b-12d3-a456-426614174001',
		name: 'Red Wine',
		item_type: 'alcohol',
		quantity: '2 bottles',
		is_assigned: true,
		is_owned: false,
		note_html: ''
	};

	const mockOwnedItem: PotluckItemRetrieveSchema = {
		...mockItem,
		id: '123e4567-e89b-12d3-a456-426614174002',
		name: 'Homemade Brownies',
		item_type: 'dessert',
		quantity: '24 pieces',
		is_assigned: true,
		is_owned: true,
		note_html: '<p>Chocolate with walnuts</p>'
	};

	it('renders unclaimed item correctly', () => {
		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn()
			}
		});

		expect(screen.getByRole('article')).toBeInTheDocument();
		expect(screen.getByText('Pasta Salad')).toBeInTheDocument();
		expect(screen.getByText('Side Dish • Serves 8')).toBeInTheDocument();
		expect(screen.getByText('Unclaimed')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /claim pasta salad/i })).toBeInTheDocument();
		expect(screen.getByText("I'll bring this")).toBeInTheDocument();
	});

	it('renders claimed item (owned by user) correctly', () => {
		render(PotluckItem, {
			props: {
				item: mockOwnedItem,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn()
			}
		});

		expect(screen.getByText('Homemade Brownies')).toBeInTheDocument();
		expect(screen.getByText("You're bringing")).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /unclaim homemade brownies/i })).toBeInTheDocument();
		expect(screen.getByText('Unclaim')).toBeInTheDocument();
	});

	it('renders claimed item (by other user) correctly', () => {
		render(PotluckItem, {
			props: {
				item: mockClaimedByOther,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn()
			}
		});

		expect(screen.getByText('Red Wine')).toBeInTheDocument();
		expect(screen.getByText('Claimed')).toBeInTheDocument();
		expect(screen.getByText('(Already claimed)')).toBeInTheDocument();

		const button = screen.getByRole('button', { name: /claim red wine/i });
		expect(button).toBeDisabled();
	});

	it('calls onClaim when unclaimed item is clicked', async () => {
		const user = userEvent.setup();
		const onClaim = vi.fn();

		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: false,
				canClaim: true,
				onClaim,
				onUnclaim: vi.fn()
			}
		});

		const button = screen.getByRole('button', { name: /claim pasta salad/i });
		await user.click(button);

		expect(onClaim).toHaveBeenCalledWith(mockItem.id);
		expect(onClaim).toHaveBeenCalledTimes(1);
	});

	it('calls onUnclaim when owned item is clicked', async () => {
		const user = userEvent.setup();
		const onUnclaim = vi.fn();

		render(PotluckItem, {
			props: {
				item: mockOwnedItem,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim
			}
		});

		const button = screen.getByRole('button', { name: /unclaim homemade brownies/i });
		await user.click(button);

		expect(onUnclaim).toHaveBeenCalledWith(mockOwnedItem.id);
		expect(onUnclaim).toHaveBeenCalledTimes(1);
	});

	it('disables claim button when user cannot claim', () => {
		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: false,
				canClaim: false,
				onClaim: vi.fn(),
				onUnclaim: vi.fn()
			}
		});

		const button = screen.getByRole('button', { name: /claim pasta salad/i });
		expect(button).toBeDisabled();
		expect(screen.getByText('RSVP to claim')).toBeInTheDocument();
	});

	it('shows organizer actions when isOrganizer is true', () => {
		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: true,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn(),
				onEdit: vi.fn(),
				onDelete: vi.fn()
			}
		});

		expect(screen.getByRole('button', { name: /edit pasta salad/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /delete pasta salad/i })).toBeInTheDocument();
	});

	it('hides organizer actions when isOrganizer is false', () => {
		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn()
			}
		});

		expect(screen.queryByRole('button', { name: /edit pasta salad/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /delete pasta salad/i })).not.toBeInTheDocument();
	});

	it('calls onEdit when edit button is clicked', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();

		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: true,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn(),
				onEdit,
				onDelete: vi.fn()
			}
		});

		const editButton = screen.getByRole('button', { name: /edit pasta salad/i });
		await user.click(editButton);

		expect(onEdit).toHaveBeenCalledWith(mockItem.id);
		expect(onEdit).toHaveBeenCalledTimes(1);
	});

	it('calls onDelete when delete button is clicked', async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();

		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: true,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn(),
				onEdit: vi.fn(),
				onDelete
			}
		});

		const deleteButton = screen.getByRole('button', { name: /delete pasta salad/i });
		await user.click(deleteButton);

		expect(onDelete).toHaveBeenCalledWith(mockItem.id);
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it('renders HTML note safely', () => {
		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn()
			}
		});

		expect(screen.getByText(/gluten-free pasta/i)).toBeInTheDocument();
	});

	it('does not render note section when note_html is empty', () => {
		render(PotluckItem, {
			props: {
				item: mockClaimedByOther,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn()
			}
		});

		// Check that prose div is not in the document
		const article = screen.getByRole('article');
		const proseDiv = article.querySelector('.prose');
		expect(proseDiv).not.toBeInTheDocument();
	});

	it('displays correct item type labels', () => {
		const testCases = [
			{ item_type: 'main_course', expected: 'Main Course' },
			{ item_type: 'dessert', expected: 'Dessert' },
			{ item_type: 'alcohol', expected: 'Alcohol' },
			{ item_type: 'labor', expected: 'Labor/Help' },
			{ item_type: 'misc', expected: 'Other' }
		];

		testCases.forEach(({ item_type, expected }) => {
			const { unmount } = render(PotluckItem, {
				props: {
					item: { ...mockItem, item_type },
					isOrganizer: false,
					canClaim: true,
					onClaim: vi.fn(),
					onUnclaim: vi.fn()
				}
			});

			expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
			unmount();
		});
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();
		const onClaim = vi.fn();

		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: true,
				canClaim: true,
				onClaim,
				onUnclaim: vi.fn(),
				onEdit: vi.fn(),
				onDelete: vi.fn()
			}
		});

		// Tab to claim button
		await user.tab();
		const claimButton = screen.getByRole('button', { name: /claim pasta salad/i });
		expect(claimButton).toHaveFocus();

		// Press Enter to claim
		await user.keyboard('{Enter}');
		expect(onClaim).toHaveBeenCalledWith(mockItem.id);

		// Tab to edit button
		await user.tab();
		const editButton = screen.getByRole('button', { name: /edit pasta salad/i });
		expect(editButton).toHaveFocus();

		// Tab to delete button
		await user.tab();
		const deleteButton = screen.getByRole('button', { name: /delete pasta salad/i });
		expect(deleteButton).toHaveFocus();
	});

	it('has descriptive aria-label for screen readers', () => {
		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn()
			}
		});

		const article = screen.getByRole('article');
		expect(article).toHaveAttribute('aria-label', 'Pasta Salad, Side Dish, Serves 8, Unclaimed');
	});

	it('applies custom className', () => {
		render(PotluckItem, {
			props: {
				item: mockItem,
				isOrganizer: false,
				canClaim: true,
				onClaim: vi.fn(),
				onUnclaim: vi.fn(),
				class: 'custom-test-class'
			}
		});

		const article = screen.getByRole('article');
		expect(article).toHaveClass('custom-test-class');
	});
});
