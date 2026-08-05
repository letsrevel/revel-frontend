import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { PollStatus } from '$lib/api/generated/types.gen';
import PollStatusBadge from './PollStatusBadge.svelte';

/**
 * REGRESSION GUARD, same shape as `members/SubscriptionStatusBadge.test.ts`:
 * this pill's status text is a cross-surface contract (admin poll list/detail
 * cards locate it by that text, which since #795 is also its accessible name),
 * not decoration. Every status is pinned, not a sample.
 */
const STATUS_ORDER: PollStatus[] = ['draft', 'open', 'closed'];

const LABELS: Record<PollStatus, string> = {
	draft: 'Draft',
	open: 'Open',
	closed: 'Closed'
};

const EXPECTED_TONE_CLASS: Record<PollStatus, string> = {
	draft: 'bg-highlight',
	open: 'bg-success',
	closed: 'bg-muted'
};

describe('polls/PollStatusBadge', () => {
	it.each(STATUS_ORDER)('renders the %s label on the pill', (status) => {
		render(PollStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	it.each(STATUS_ORDER)('maps %s to its tone class', (status) => {
		const { container } = render(PollStatusBadge, { props: { status } });
		expect(container.querySelector('span')?.className).toContain(EXPECTED_TONE_CLASS[status]);
	});
});
