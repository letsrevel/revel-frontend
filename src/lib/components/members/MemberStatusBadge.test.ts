import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { MembershipStatus } from '$lib/api/generated/types.gen';
import { getMemberStatusLabel, MEMBER_STATUS_ORDER } from '$lib/utils/member-status';
import MemberStatusBadge from './MemberStatusBadge.svelte';

/**
 * REGRESSION GUARD, mirroring `members/SubscriptionStatusBadge.test.ts`: this
 * pill's status text is what locates it in `MemberCard` (roster), and since #795
 * it is the accessible name too. Every enum value is asserted, not a sample,
 * since the failure mode drops all of them at once.
 */
describe('members/MemberStatusBadge', () => {
	it.each(MEMBER_STATUS_ORDER as MembershipStatus[])(
		'renders the %s label on the pill',
		(status) => {
			render(MemberStatusBadge, { props: { status } });
			const label = getMemberStatusLabel(status);
			expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
		}
	);

	it('maps banned to the danger tone', () => {
		const { container } = render(MemberStatusBadge, { props: { status: 'banned' } });
		expect(container.querySelector('span')?.className).toContain('bg-destructive');
	});

	it('maps active to the success tone', () => {
		const { container } = render(MemberStatusBadge, { props: { status: 'active' } });
		expect(container.querySelector('span')?.className).toContain('bg-success');
	});

	it('labels awaiting_payment "Awaiting payment" and maps it to the warning tone', () => {
		const { container } = render(MemberStatusBadge, { props: { status: 'awaiting_payment' } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Awaiting payment');
		expect(container.querySelector('span')?.className).toContain('bg-highlight');
	});

	it('lists awaiting_payment among the member statuses', () => {
		expect(MEMBER_STATUS_ORDER).toContain('awaiting_payment');
	});
});
