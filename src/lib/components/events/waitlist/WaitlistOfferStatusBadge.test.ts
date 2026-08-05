import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { WaitlistOfferStatus } from '$lib/api/generated/types.gen';
import WaitlistOfferStatusBadge, {
	WAITLIST_OFFER_STATUS_ORDER
} from './WaitlistOfferStatusBadge.svelte';

const LABELS: Record<WaitlistOfferStatus, string> = {
	pending: m['offerStatus.pending'](),
	claimed: m['offerStatus.claimed'](),
	expired: m['offerStatus.expired'](),
	revoked: m['offerStatus.revoked']()
};

/**
 * REGRESSION GUARD (see members/SubscriptionStatusBadge.test.ts for the incident
 * this pattern guards against). The badge is addressed by `status-badge` plus its
 * status text, which since #795 is also its accessible name — pin every enum
 * value, since the failure mode drops all of them at once.
 */
describe('events/waitlist/WaitlistOfferStatusBadge', () => {
	it.each(WAITLIST_OFFER_STATUS_ORDER)('renders the %s label on the pill', (status) => {
		render(WaitlistOfferStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	it('maps status to the primitive tone (claimed → success, revoked → danger)', () => {
		const claimed = render(WaitlistOfferStatusBadge, { props: { status: 'claimed' } });
		expect(claimed.container.querySelector('span')?.className).toContain('bg-success');

		const revoked = render(WaitlistOfferStatusBadge, { props: { status: 'revoked' } });
		expect(revoked.container.querySelector('span')?.className).toContain('bg-destructive');
	});

	it('keeps the caller class alongside the tone classes', () => {
		const { container } = render(WaitlistOfferStatusBadge, {
			props: { status: 'pending', class: 'shrink-0' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('shrink-0');
		expect(el.className).toContain('bg-highlight');
	});
});
