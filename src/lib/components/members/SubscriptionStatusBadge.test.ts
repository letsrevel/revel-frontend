import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { SubscriptionStatus } from '$lib/api/generated/types.gen';
import { getStatusLabel, STATUS_ORDER } from '$lib/utils/subscriptions';
import SubscriptionStatusBadge from './SubscriptionStatusBadge.svelte';

/**
 * REGRESSION GUARD. This badge's status LABEL is a cross-surface contract, not
 * decoration: the e2e suite addresses every subscription pill by
 * `status-badge` + 'Active' | 'Pending' | 'Past due' | … — on the account hub
 * card, the org landing page's inline card, the admin subs table/mobile card
 * and the admin subscription drawer.
 *
 * The 2026-08 rebrand wave turned this component into a thin mapper over
 * `common/StatusBadge` and dropped the pill's `aria-label` in the process; 19
 * e2e tests went red while every unit test stayed green, because nothing here
 * asserted it. Hence this file. #795 has since removed the ARIA name entirely —
 * on a role-less <span> it never reached assistive technology anyway — so the
 * visible text is now the whole contract, and this file is what pins it.
 */
describe('members/SubscriptionStatusBadge', () => {
	// Every status, not just a sample: the whole failure mode was a name that
	// vanished for all six at once, and a spot-check of one would have caught
	// that only by luck.
	it.each(STATUS_ORDER as SubscriptionStatus[])('renders the %s label on the pill', (status) => {
		render(SubscriptionStatusBadge, { props: { status } });
		const label = getStatusLabel(status);
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	it('names past_due "Past due" — the label carries the distinction the tone cannot', () => {
		render(SubscriptionStatusBadge, { props: { status: 'past_due' } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Past due');
		expect(screen.queryByText('Active')).toBeNull();
	});

	it('maps status to the primitive tone (active → success, past_due → danger)', () => {
		const active = render(SubscriptionStatusBadge, { props: { status: 'active' } });
		expect(active.container.querySelector('span')?.className).toContain('bg-success');

		const pastDue = render(SubscriptionStatusBadge, { props: { status: 'past_due' } });
		expect(pastDue.container.querySelector('span')?.className).toContain('bg-destructive');
	});

	it('keeps the caller class alongside the tone classes', () => {
		const { container } = render(SubscriptionStatusBadge, {
			props: { status: 'active', class: 'shrink-0' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('shrink-0');
		expect(el.className).toContain('bg-success');
	});
});
