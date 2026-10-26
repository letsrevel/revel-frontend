import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TierFormCancellationSection from './TierFormCancellationSection.svelte';

function renderSection(props: Record<string, unknown>) {
	render(TierFormCancellationSection, {
		props: {
			paymentMethod: 'free',
			allowUserCancellation: true,
			cancellationDeadlineHours: null,
			refundPolicy: null,

			currencySymbol: '€',
			isPending: false,
			...props
		}
	});
}

const TOGGLE = /Allow attendees to cancel their tickets/;

describe('TierFormCancellationSection', () => {
	it('shows the toggle, deadline and free copy, but no refund policy, for free tiers', () => {
		renderSection({ paymentMethod: 'free' });
		expect(screen.getByLabelText(TOGGLE)).toBeChecked();
		expect(screen.getByText('Cancellation')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Lets ticket holders cancel their ticket and release the spot for someone else.'
			)
		).toBeInTheDocument();
		expect(screen.getByText(/Cancellation deadline/i)).toBeInTheDocument();
		expect(screen.queryByText(/Cancellation & refunds/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Add another bracket/)).not.toBeInTheDocument();
	});

	it('hides the deadline when the toggle is off', () => {
		renderSection({ paymentMethod: 'free', allowUserCancellation: false });
		expect(screen.getByLabelText(TOGGLE)).not.toBeChecked();
		expect(screen.queryByText(/Cancellation deadline/i)).not.toBeInTheDocument();
	});

	it('shows the refund policy editor for online tiers', () => {
		renderSection({ paymentMethod: 'online' });
		expect(screen.getByText('Cancellation & refunds')).toBeInTheDocument();
		expect(screen.getByText(/Add another bracket/)).toBeInTheDocument();
	});
});
