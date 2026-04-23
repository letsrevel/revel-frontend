import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import CadenceDriftBanner from './CadenceDriftBanner.svelte';

describe('CadenceDriftBanner', () => {
	it('renders nothing when count is 0', () => {
		const { container } = render(CadenceDriftBanner, { props: { count: 0 } });
		expect(container.querySelector('[data-testid="drift-banner"]')).toBeNull();
	});

	it('renders the banner when count > 0', () => {
		render(CadenceDriftBanner, { props: { count: 3 } });
		expect(screen.getByTestId('drift-banner')).toBeInTheDocument();
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('renders a Review stale dates anchor pointing at the review anchor prop', () => {
		render(CadenceDriftBanner, {
			props: { count: 2, reviewAnchor: '#custom-anchor' }
		});
		const anchor = screen.getByRole('link');
		expect(anchor.getAttribute('href')).toBe('#custom-anchor');
	});

	it('hides the bulk-cancel button by default (canEdit=false)', () => {
		const onBulkCancel = vi.fn();
		render(CadenceDriftBanner, { props: { count: 2, onBulkCancel } });
		expect(screen.queryByTestId('drift-bulk-cancel')).toBeNull();
	});

	it('hides the bulk-cancel button when canEdit=true but onBulkCancel is not supplied', () => {
		render(CadenceDriftBanner, { props: { count: 2, canEdit: true } });
		expect(screen.queryByTestId('drift-bulk-cancel')).toBeNull();
	});

	it('shows the bulk-cancel button only when canEdit=true AND onBulkCancel is supplied', () => {
		const onBulkCancel = vi.fn();
		render(CadenceDriftBanner, {
			props: { count: 5, canEdit: true, onBulkCancel }
		});
		expect(screen.getByTestId('drift-bulk-cancel')).toBeInTheDocument();
	});

	it('invokes onBulkCancel when the bulk-cancel button is clicked', async () => {
		const user = userEvent.setup();
		const onBulkCancel = vi.fn();
		render(CadenceDriftBanner, {
			props: { count: 5, canEdit: true, onBulkCancel }
		});
		await user.click(screen.getByTestId('drift-bulk-cancel'));
		expect(onBulkCancel).toHaveBeenCalledTimes(1);
	});
});
