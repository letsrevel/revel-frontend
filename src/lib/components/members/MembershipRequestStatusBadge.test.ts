import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { MembershipRequestStatus } from '$lib/api/generated/types.gen';
import {
	getMembershipRequestStatusLabel,
	MEMBERSHIP_REQUEST_STATUS_ORDER
} from '$lib/utils/membership-request-status';
import MembershipRequestStatusBadge from './MembershipRequestStatusBadge.svelte';

/**
 * REGRESSION GUARD, mirroring `members/StatusBadge.test.ts`: this pill's
 * accessible NAME is what locates the "not pending" branch of
 * `MembershipRequestCard` (the review-history badge shown once actions are no
 * longer offered). Every enum value is asserted, not a sample.
 */
describe('members/MembershipRequestStatusBadge', () => {
	it.each(MEMBERSHIP_REQUEST_STATUS_ORDER as MembershipRequestStatus[])(
		'exposes the %s label as the pill accessible name',
		(status) => {
			render(MembershipRequestStatusBadge, { props: { status } });
			const label = getMembershipRequestStatusLabel(status);
			expect(screen.getByLabelText(label)).toBeInTheDocument();
			expect(screen.getByLabelText(label)).toHaveTextContent(label);
		}
	);

	it('maps rejected to the danger tone', () => {
		const { container } = render(MembershipRequestStatusBadge, {
			props: { status: 'rejected' }
		});
		expect(container.querySelector('span')?.className).toContain('bg-destructive');
	});

	it('maps approved and completed to the same success tone', () => {
		const approved = render(MembershipRequestStatusBadge, { props: { status: 'approved' } });
		expect(approved.container.querySelector('span')?.className).toContain('bg-success');

		const completed = render(MembershipRequestStatusBadge, { props: { status: 'completed' } });
		expect(completed.container.querySelector('span')?.className).toContain('bg-success');
	});
});
