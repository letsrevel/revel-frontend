import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { SubscriptionStatus } from '$lib/api/generated/types.gen';
import { getStatusLabel, STATUS_ORDER } from '$lib/utils/subscriptions';
import SubscriptionStatusBadge from './SubscriptionStatusBadge.svelte';

/**
 * REGRESSION GUARD. This badge's accessible NAME is a cross-surface contract,
 * not decoration: the e2e suite addresses every subscription pill by
 * `getByLabel('Active' | 'Pending' | 'Past due' | …)` — on the account hub
 * card, the org landing page's inline card, the admin subs table/mobile card
 * and the admin subscription drawer — and the admin metrics strip deliberately
 * leaves its own chips unlabelled so those lookups resolve to badges ONLY.
 *
 * The 2026-08 rebrand wave turned this component into a thin mapper over
 * `common/StatusBadge` and dropped its `aria-label` in the process. The
 * primitive named itself from its text content only, `getByLabel` never matches
 * text content, and 19 e2e tests went red while every unit test stayed green —
 * because nothing here asserted the name. Hence this file. #788 later made the
 * primitive default the name; this file is why that default is safe to trust.
 */
describe('members/SubscriptionStatusBadge', () => {
	// Every status, not just a sample: the whole failure mode was a name that
	// vanished for all six at once, and a spot-check of one would have caught
	// that only by luck.
	it.each(STATUS_ORDER as SubscriptionStatus[])(
		'exposes the %s label as the pill accessible name',
		(status) => {
			render(SubscriptionStatusBadge, { props: { status } });
			const label = getStatusLabel(status);
			expect(screen.getByLabelText(label)).toBeInTheDocument();
			// The name is an alias for what is on screen, never a substitute for it.
			expect(screen.getByLabelText(label)).toHaveTextContent(label);
		}
	);

	it('names past_due "Past due" — the label carries the distinction the tone cannot', () => {
		render(SubscriptionStatusBadge, { props: { status: 'past_due' } });
		expect(screen.getByLabelText('Past due')).toBeInTheDocument();
		expect(screen.queryByLabelText('Active')).toBeNull();
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
