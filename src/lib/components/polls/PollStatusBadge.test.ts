import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { PollStatus } from '$lib/api/generated/types.gen';
import PollStatusBadge from './PollStatusBadge.svelte';

/**
 * REGRESSION GUARD, same shape as `members/StatusBadge.test.ts`: this pill's
 * accessible NAME is a cross-surface contract (admin poll list/detail cards
 * locate it by its status text), not decoration. `PollStatusBadge` shipped in
 * an earlier wave as a `common/StatusBadge` mapper WITHOUT an `aria-label` —
 * the primitive does not default one from its content — so this guards every
 * status, not just a sample, against that name being silently absent.
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
	it.each(STATUS_ORDER)('exposes the %s label as the pill accessible name', (status) => {
		render(PollStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByLabelText(label)).toBeInTheDocument();
		expect(screen.getByLabelText(label)).toHaveTextContent(label);
	});

	it.each(STATUS_ORDER)('maps %s to its tone class', (status) => {
		const { container } = render(PollStatusBadge, { props: { status } });
		expect(container.querySelector('span')?.className).toContain(EXPECTED_TONE_CLASS[status]);
	});
});
