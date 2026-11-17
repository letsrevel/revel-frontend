import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ApproveMembershipModal from './ApproveMembershipModal.svelte';
import type { OrganizationMembershipRequestRetrieve } from '$lib/api/generated/types.gen';

function makeRequest(
	plan: { payment_method: 'offline' | 'online' } | null
): OrganizationMembershipRequestRetrieve {
	return {
		id: 'req-1',
		status: 'pending',
		created_at: '2026-07-20T10:00:00Z',
		plan,
		user: { id: 'u', email: 'a@example.com', first_name: 'Ada', last_name: 'Lovelace' }
	} as unknown as OrganizationMembershipRequestRetrieve;
}

function open(plan: { payment_method: 'offline' | 'online' } | null) {
	render(ApproveMembershipModal, {
		props: {
			request: makeRequest(plan),
			tiers: [],
			open: true,
			onClose: vi.fn(),
			onConfirm: vi.fn()
		}
	});
}

describe('ApproveMembershipModal copy per plan type', () => {
	it('explains the awaiting-payment hold for offline plans', async () => {
		open({ payment_method: 'offline' });
		expect(
			await screen.findByText(
				'Approving holds Ada Lovelace as a member awaiting payment and sends them your payment instructions. They become active when you record the first payment.'
			)
		).toBeInTheDocument();
	});

	it('explains checkout for online plans', async () => {
		open({ payment_method: 'online' });
		expect(
			await screen.findByText(
				'Approving lets Ada Lovelace complete checkout. They become a member once the payment goes through.'
			)
		).toBeInTheDocument();
	});

	it('keeps the generic copy when there is no plan', async () => {
		open(null);
		expect(
			await screen.findByText('Select a membership tier to assign to Ada Lovelace.')
		).toBeInTheDocument();
	});
});
