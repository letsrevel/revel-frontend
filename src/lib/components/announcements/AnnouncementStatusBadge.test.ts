import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { AnnouncementStatus } from '$lib/api/generated/types.gen';
import AnnouncementStatusBadge from './AnnouncementStatusBadge.svelte';

const STATUSES: AnnouncementStatus[] = ['draft', 'scheduled', 'sent'];

const LABELS: Record<AnnouncementStatus, string> = {
	draft: 'Draft',
	scheduled: 'Scheduled',
	sent: 'Sent'
};

/**
 * REGRESSION GUARD, same shape as `members/SubscriptionStatusBadge.test.ts`: this mapper
 * wraps `common/StatusBadge`. The accessible NAME is what lets callers (and
 * any future e2e lookup) address the pill via `getByLabelText` — passed here
 * explicitly and, since #788, defaulted by the primitive as well. Assert it
 * for every enum value, not a
 * sample, so a status silently losing its name doesn't slip through.
 */
describe('announcements/AnnouncementStatusBadge', () => {
	it.each(STATUSES)('exposes the %s label as the pill accessible name', (status) => {
		render(AnnouncementStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByLabelText(label)).toBeInTheDocument();
		expect(screen.getByLabelText(label)).toHaveTextContent(label);
	});

	it('maps status to the primitive tone (draft → neutral, scheduled → info, sent → success)', () => {
		const draft = render(AnnouncementStatusBadge, { props: { status: 'draft' } });
		expect(draft.container.querySelector('span')?.className).toContain('bg-muted');

		const scheduled = render(AnnouncementStatusBadge, { props: { status: 'scheduled' } });
		expect(scheduled.container.querySelector('span')?.className).toContain('bg-info');

		const sent = render(AnnouncementStatusBadge, { props: { status: 'sent' } });
		expect(sent.container.querySelector('span')?.className).toContain('bg-success');
	});
});
