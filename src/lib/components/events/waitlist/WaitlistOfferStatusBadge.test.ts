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
 * REGRESSION GUARD (see members/StatusBadge.test.ts for the incident this
 * pattern guards against). `common/StatusBadge` names itself from its text
 * content only — it never defaults `aria-label` — so every domain mapper
 * must pass it explicitly or `getByLabel` lookups against the badge silently
 * stop resolving. Pin every enum value, not a sample.
 */
describe('events/waitlist/WaitlistOfferStatusBadge', () => {
	it.each(WAITLIST_OFFER_STATUS_ORDER)(
		'exposes the %s label as the pill accessible name',
		(status) => {
			render(WaitlistOfferStatusBadge, { props: { status } });
			const label = LABELS[status];
			expect(screen.getByLabelText(label)).toBeInTheDocument();
			expect(screen.getByLabelText(label)).toHaveTextContent(label);
		}
	);

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
