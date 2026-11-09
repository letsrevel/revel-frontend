import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
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

describe('StaffCard remove', () => {
	it('reports the intent to the list owner, which owns the confirmation dialog', async () => {
		const user = userEvent.setup();
		const onRemove = renderCard();

		await user.click(screen.getByRole('button', { name: /Remove Ada Lovelace from staff/ }));

		expect(onRemove).toHaveBeenCalledExactlyOnceWith(staff);
		expect(screen.queryByRole('dialog')).toBeNull();
	});
});
