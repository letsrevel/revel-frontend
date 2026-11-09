import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import StaffCard from './StaffCard.svelte';
import type { OrganizationStaffSchema } from '$lib/api/generated/types.gen';

const staff = {
	id: 'staff-1',
	staff_since: '2024-01-01T00:00:00Z',
	user: { id: 'u1', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
	permissions: { default: {} }
} as unknown as OrganizationStaffSchema;

function renderCard(onRemove = vi.fn()) {
	render(StaffCard, {
		props: {
			staff,
			canRemove: true,
			canEditPermissions: false,
			onRemove,
			onEditPermissions: vi.fn()
		}
	});
	return onRemove;
}

describe('StaffCard remove confirmation', () => {
	it('asks in-app first and removes only after explicit confirmation', async () => {
		const user = userEvent.setup();
		const onRemove = renderCard();

		await user.click(screen.getByRole('button', { name: /Remove Ada Lovelace from staff/ }));
		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveTextContent('Ada Lovelace');
		expect(onRemove).not.toHaveBeenCalled();

		await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
		expect(onRemove).toHaveBeenCalledWith(staff);
	});

	it('does not remove when cancelled', async () => {
		const user = userEvent.setup();
		const onRemove = renderCard();

		await user.click(screen.getByRole('button', { name: /Remove Ada Lovelace from staff/ }));
		await user.click(
			within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' })
		);

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(onRemove).not.toHaveBeenCalled();
	});
});
